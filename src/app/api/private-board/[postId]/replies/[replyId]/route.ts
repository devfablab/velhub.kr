import sharp from 'sharp';
import { getPrivateBoardAccess, getPrivateBoardSiteName } from '@/lib/private-board/access';
import { normalizeText } from '@/lib/utils';

const MAX_IMAGE_SIZE = 1024 * 1024;
const MAX_IMAGE_COUNT = 5;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function getRetainedImageIds(value: FormDataEntryValue | null) {
  try {
    const parsed = JSON.parse(String(value ?? '')) as unknown;

    if (!Array.isArray(parsed)) return [];

    return [...new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0))];
  } catch {
    return [];
  }
}

async function getReplyAccess(request: Request, postId: string, replyId: string) {
  const siteName = getPrivateBoardSiteName(new URL(request.url).searchParams.get('siteName'));

  if (!siteName || !postId || !replyId) {
    return { ok: false, status: 400, error: '요청 정보가 유효하지 않습니다.' } as const;
  }

  const access = await getPrivateBoardAccess(siteName);

  if (!access.ok) return access;

  const reply = await access.supabaseAdmin
    .from('private_post_replies')
    .select('id, author_stigma_id, author_type, content_html, created_at')
    .eq('id', replyId)
    .eq('private_post_id', postId)
    .eq('site_id', access.site.id)
    .maybeSingle();

  if (reply.error || !reply.data) {
    return { ok: false, status: 404, error: '답변을 찾을 수 없습니다.' } as const;
  }

  if (reply.data.author_stigma_id !== access.stigmaId) {
    return { ok: false, status: 403, error: '본인이 작성한 글만 수정할 수 있습니다.' } as const;
  }

  if (Date.now() - new Date(reply.data.created_at).getTime() > 5 * 60 * 1000) {
    return { ok: false, status: 400, error: '답변은 작성 후 5분 동안만 수정할 수 있습니다.' } as const;
  }

  return { ok: true, access, reply: reply.data } as const;
}

export async function GET(request: Request, { params }: { params: Promise<{ postId: string; replyId: string }> }) {
  const { postId, replyId } = await params;
  const result = await getReplyAccess(request, postId, replyId);

  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

  return Response.json({ reply: result.reply });
}

export async function PUT(request: Request, { params }: { params: Promise<{ postId: string; replyId: string }> }) {
  const { postId, replyId } = await params;
  const result = await getReplyAccess(request, postId, replyId);

  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

  const formData = await request.formData();
  const contentHtml = normalizeText(formData.get('contentHtml') as string | null);
  const retainedImageIds = getRetainedImageIds(formData.get('retainedImageIds'));
  const newImages = formData.getAll('images').filter((value): value is File => value instanceof File && value.size > 0);

  if (!contentHtml) return Response.json({ error: '내용을 입력해 주세요.' }, { status: 400 });
  if (newImages.some((image) => image.size > MAX_IMAGE_SIZE || !IMAGE_TYPES.has(image.type))) {
    return Response.json({ error: '이미지는 1MB 이하의 PNG, JPEG, WEBP 파일만 첨부할 수 있습니다.' }, { status: 400 });
  }
  if (newImages.length > 0 && !result.access.board.is_image_enabled) {
    return Response.json({ error: '첨부 이미지를 사용할 수 없습니다.' }, { status: 400 });
  }

  const existingImages = await result.access.supabaseAdmin
    .from('private_post_images')
    .select('id, storage_path, sort_order')
    .eq('private_post_reply_id', replyId)
    .order('sort_order');
  if (existingImages.error) return Response.json({ error: '첨부 이미지를 불러오지 못했습니다.' }, { status: 500 });

  const existingImageRows = existingImages.data ?? [];
  const existingImageIds = new Set(existingImageRows.map((image) => image.id));
  if (retainedImageIds.some((id) => !existingImageIds.has(id))) {
    return Response.json({ error: '첨부 이미지 정보가 유효하지 않습니다.' }, { status: 400 });
  }
  if (retainedImageIds.length + newImages.length > MAX_IMAGE_COUNT) {
    return Response.json({ error: '이미지는 최대 5개까지 첨부할 수 있습니다.' }, { status: 400 });
  }

  const uploadedPaths: string[] = [];
  const uploadedImages: { storagePath: string; width: number | null; height: number | null }[] = [];

  try {
    for (const image of newImages) {
      const converted = await sharp(Buffer.from(await image.arrayBuffer()))
        .webp({ quality: 85 })
        .toBuffer({ resolveWithObject: true });
      const storagePath = `${result.access.site.id}/${postId}/${replyId}/${crypto.randomUUID()}.webp`;
      const upload = await result.access.supabaseAdmin.storage
        .from('private-post-images')
        .upload(storagePath, converted.data, { contentType: 'image/webp', upsert: false });
      if (upload.error) throw new Error('이미지 업로드에 실패했습니다.');

      uploadedPaths.push(storagePath);
      uploadedImages.push({
        storagePath,
        width: converted.info.width ?? null,
        height: converted.info.height ?? null,
      });
    }
  } catch (error) {
    if (uploadedPaths.length)
      await result.access.supabaseAdmin.storage.from('private-post-images').remove(uploadedPaths);
    return Response.json(
      { error: error instanceof Error ? error.message : '이미지 업로드에 실패했습니다.' },
      { status: 500 },
    );
  }

  const update = await result.access.supabaseAdmin
    .from('private_post_replies')
    .update({ content_html: contentHtml, updated_at: new Date().toISOString() })
    .eq('id', replyId)
    .eq('private_post_id', postId)
    .eq('site_id', result.access.site.id);

  if (update.error) {
    if (uploadedPaths.length)
      await result.access.supabaseAdmin.storage.from('private-post-images').remove(uploadedPaths);
    return Response.json({ error: '답변 수정에 실패했습니다.' }, { status: 500 });
  }

  const maxSortOrder = Math.max(-1, ...existingImageRows.map((image) => image.sort_order));
  if (uploadedImages.length) {
    const insertImages = await result.access.supabaseAdmin.from('private_post_images').insert(
      uploadedImages.map((image, index) => ({
        site_id: result.access.site.id,
        private_post_reply_id: replyId,
        storage_path: image.storagePath,
        image_width: image.width,
        image_height: image.height,
        sort_order: maxSortOrder + index + 1,
      })),
    );
    if (insertImages.error) {
      await result.access.supabaseAdmin.storage.from('private-post-images').remove(uploadedPaths);
      return Response.json({ error: '첨부 이미지 저장에 실패했습니다.' }, { status: 500 });
    }
  }

  const removedImages = existingImageRows.filter((image) => !retainedImageIds.includes(image.id));
  if (removedImages.length) {
    const deleteImages = await result.access.supabaseAdmin
      .from('private_post_images')
      .delete()
      .in(
        'id',
        removedImages.map((image) => image.id),
      );
    if (deleteImages.error) return Response.json({ error: '첨부 이미지 삭제에 실패했습니다.' }, { status: 500 });

    await result.access.supabaseAdmin.storage
      .from('private-post-images')
      .remove(removedImages.map((image) => image.storage_path));
  }

  return Response.json({ ok: true });
}
