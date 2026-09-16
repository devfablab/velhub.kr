import sharp from 'sharp';
import { getPrivateBoardAccess, getPrivateBoardSiteName } from '@/lib/private-board/access';
import { normalizeText } from '@/lib/utils';

const MAX_IMAGE_SIZE = 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export async function POST(request: Request) {
  const formData = await request.formData();
  const siteName = getPrivateBoardSiteName(formData.get('siteName') as string | null);
  const categoryId = normalizeText(formData.get('categoryId') as string | null);
  const subject = normalizeText(formData.get('subject') as string | null);
  const contentHtml = normalizeText(formData.get('contentHtml') as string | null);
  const images = formData.getAll('images').filter((value): value is File => value instanceof File && value.size > 0);

  if (!siteName || !categoryId || !subject || !contentHtml)
    return Response.json({ error: '카테고리, 제목, 내용을 입력해 주세요.' }, { status: 400 });
  if (images.length > 5) return Response.json({ error: '이미지는 최대 5개까지 첨부할 수 있습니다.' }, { status: 400 });
  if (images.some((image) => image.size > MAX_IMAGE_SIZE || !IMAGE_TYPES.has(image.type))) {
    return Response.json({ error: '이미지는 1MB 이하의 PNG, JPEG, WEBP 파일만 첨부할 수 있습니다.' }, { status: 400 });
  }

  const access = await getPrivateBoardAccess(siteName);
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });
  if (images.length > 0 && !access.board.is_image_enabled)
    return Response.json({ error: '첨부 이미지를 사용할 수 없습니다.' }, { status: 400 });

  const category = await access.supabaseAdmin
    .from('private_board_categories')
    .select('id')
    .eq('id', categoryId)
    .eq('private_board_id', access.board.id)
    .maybeSingle();
  if (category.error || !category.data)
    return Response.json({ error: '카테고리를 찾을 수 없습니다.' }, { status: 400 });

  const post = await access.supabaseAdmin
    .from('private_posts')
    .insert({
      site_id: access.site.id,
      private_board_id: access.board.id,
      category_id: categoryId,
      author_stigma_id: access.stigmaId,
      subject,
      content_html: contentHtml,
    })
    .select('id')
    .single();
  if (post.error || !post.data) return Response.json({ error: '글 작성에 실패했습니다.' }, { status: 500 });

  const uploadedPaths: string[] = [];
  try {
    const imageRows = [];
    for (const [index, image] of images.entries()) {
      const converted = await sharp(Buffer.from(await image.arrayBuffer()))
        .webp({ quality: 85 })
        .toBuffer({ resolveWithObject: true });
      const storagePath = `${access.site.id}/${post.data.id}/${crypto.randomUUID()}.webp`;
      const upload = await access.supabaseAdmin.storage
        .from('private-post-images')
        .upload(storagePath, converted.data, { contentType: 'image/webp', upsert: false });
      if (upload.error) throw new Error('이미지 업로드에 실패했습니다.');
      uploadedPaths.push(storagePath);
      imageRows.push({
        site_id: access.site.id,
        private_post_id: post.data.id,
        storage_path: storagePath,
        image_width: converted.info.width ?? null,
        image_height: converted.info.height ?? null,
        sort_order: index,
      });
    }
    if (imageRows.length) {
      const insertImages = await access.supabaseAdmin.from('private_post_images').insert(imageRows);
      if (insertImages.error) throw new Error('이미지 저장에 실패했습니다.');
    }
  } catch (error) {
    if (uploadedPaths.length) await access.supabaseAdmin.storage.from('private-post-images').remove(uploadedPaths);
    await access.supabaseAdmin.from('private_posts').delete().eq('id', post.data.id);
    return Response.json(
      { error: error instanceof Error ? error.message : '글 작성에 실패했습니다.' },
      { status: 500 },
    );
  }

  return Response.json({ id: post.data.id }, { status: 201 });
}
