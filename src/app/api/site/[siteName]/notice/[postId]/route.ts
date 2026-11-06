import sharp from 'sharp';
import { r2Storage } from '@/lib/clients/r2Storage';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import {
  getNoticeContext,
  getNoticeImagePath,
  validateNoticeContent,
  validateNoticeImage,
} from '@/lib/service/blog/notice/access';
import { normalizeText } from '@/lib/utils';

type RouteContext = { params: Promise<{ siteName: string; postId: string }> };

// 글 수정(content, image, removeImage) 또는 비공개 전환(isPrivate)
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { siteName, postId } = await context.params;
    const notice = await getNoticeContext(siteName);

    if (!notice || !notice.isAvailable || !notice.board) {
      return Response.json({ error: '공지 게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!notice.isOwner) {
      return Response.json({ error: '블로그 운영자만 공지를 수정할 수 있습니다.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const postResult = await supabaseAdmin
      .from('notice_posts')
      .select('id, image_src')
      .eq('id', normalizeText(postId))
      .eq('board_id', notice.board.id)
      .maybeSingle();

    if (postResult.error) {
      return Response.json({ error: '공지를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!postResult.data) {
      return Response.json({ error: '공지를 찾을 수 없습니다.' }, { status: 404 });
    }

    const formData = await request.formData();
    const rawIsPrivate = formData.get('isPrivate');

    // 비공개 전환은 내용 수정이 아니므로 updated_at을 건드리지 않음
    if (rawIsPrivate === 'true' || rawIsPrivate === 'false') {
      const isPrivate = rawIsPrivate === 'true';
      const updateResult = await supabaseAdmin
        .from('notice_posts')
        .update({ is_private: isPrivate })
        .eq('id', postResult.data.id);

      if (updateResult.error) {
        return Response.json({ error: '공개 상태를 변경하지 못했습니다.' }, { status: 500 });
      }

      return Response.json({ ok: true, isPrivate });
    }

    const rawContent = formData.get('content');
    const content = normalizeText(typeof rawContent === 'string' ? rawContent : '');
    const image = formData.get('image');
    const imageFile = image instanceof File && image.size > 0 ? image : null;
    const isRemoveImage = formData.get('removeImage') === 'true';

    const contentError = validateNoticeContent(content);

    if (contentError) {
      return Response.json({ error: contentError }, { status: 400 });
    }

    if (imageFile) {
      const imageError = validateNoticeImage(imageFile);

      if (imageError) {
        return Response.json({ error: imageError }, { status: 400 });
      }
    }

    const previousImageSrc = normalizeText(postResult.data.image_src);
    let nextImageSrc: string | null = previousImageSrc || null;
    let uploadedPath = '';

    if (imageFile) {
      const webp = await sharp(Buffer.from(await imageFile.arrayBuffer()))
        .webp({ quality: 90 })
        .toBuffer();
      uploadedPath = getNoticeImagePath(notice.siteId, postResult.data.id);
      const upload = await r2Storage
        .from('notice')
        .upload(uploadedPath, webp, { contentType: 'image/webp', upsert: false });

      if (upload.error) {
        return Response.json({ error: '이미지를 업로드하지 못했습니다.' }, { status: 500 });
      }

      nextImageSrc = r2Storage.from('notice').getPublicUrl(uploadedPath).data.publicUrl;
    } else if (isRemoveImage) {
      nextImageSrc = null;
    }

    const updatedAt = new Date().toISOString();
    const updateResult = await supabaseAdmin
      .from('notice_posts')
      .update({ content, image_src: nextImageSrc, updated_at: updatedAt })
      .eq('id', postResult.data.id);

    if (updateResult.error) {
      if (uploadedPath) {
        await r2Storage.from('notice').remove([uploadedPath]);
      }

      return Response.json({ error: '공지를 수정하지 못했습니다.' }, { status: 500 });
    }

    // 이미지가 교체/삭제됐으면 기존 파일 정리
    // 정리 실패는 수정 결과에 영향 주지 않음
    if (previousImageSrc && previousImageSrc !== nextImageSrc) {
      await r2Storage
        .from('notice')
        .remove([previousImageSrc])
        .catch(() => null);
    }

    return Response.json({
      ok: true,
      content,
      imageUrl: nextImageSrc,
      updatedAt,
    });
  } catch (unknownError) {
    const message = unknownError instanceof Error ? unknownError.message : '';
    return Response.json({ error: message || '공지를 수정하지 못했습니다.' }, { status: 500 });
  }
}
