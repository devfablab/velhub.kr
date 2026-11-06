import sharp from 'sharp';
import { r2Storage } from '@/lib/clients/r2Storage';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import {
  getNoticeContext,
  getNoticeImagePath,
  validateNoticeContent,
  validateNoticeImage,
} from '@/lib/service/blog/notice/access';
import { getStigmaAvatarUrl } from '@/lib/users/utils';
import { normalizeText } from '@/lib/utils';

const PAGE_SIZE = 20;

type RouteContext = { params: Promise<{ siteName: string }> };

type NoticePostRow = {
  id: string;
  author_id: string;
  content: string;
  image_src: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string | null;
};

function decryptName(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '';
  }

  try {
    return normalizeText(decrypt(normalizedValue));
  } catch {
    return '';
  }
}

async function getAuthorMap(siteId: string, authorIds: string[]) {
  const authorMap = new Map<string, { name: string; avatarUrl: string | null }>();

  if (authorIds.length === 0) {
    return authorMap;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const [stigmasResult, membershipsResult] = await Promise.all([
    supabaseAdmin.from('stigmas').select('id, user_name, avatar').in('id', authorIds),
    supabaseAdmin.from('rhizome_stigmas').select('user_id, nickname').eq('site_id', siteId).in('user_id', authorIds),
  ]);

  if (stigmasResult.error || membershipsResult.error) {
    throw new Error('공지를 불러오지 못했습니다.');
  }

  const nicknameMap = new Map(
    (membershipsResult.data ?? []).map((membership) => [membership.user_id, normalizeText(membership.nickname)]),
  );

  for (const stigma of stigmasResult.data ?? []) {
    // 별명이 없으면 활동명
    authorMap.set(stigma.id, {
      name: nicknameMap.get(stigma.id) || decryptName(stigma.user_name) || '알 수 없음',
      avatarUrl: getStigmaAvatarUrl(stigma.avatar),
    });
  }

  return authorMap;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { siteName } = await context.params;
    const notice = await getNoticeContext(siteName);

    if (!notice || !notice.isAvailable || !notice.board) {
      return Response.json({ error: '공지 게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    const requestUrl = new URL(request.url);
    const requestedPage = Number(requestUrl.searchParams.get('page') ?? '1');
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const from = (page - 1) * PAGE_SIZE;

    let postsQuery = getSupabaseAdmin()
      .from('notice_posts')
      .select('id, author_id, content, image_src, is_private, created_at, updated_at', { count: 'exact' })
      .eq('board_id', notice.board.id);

    // 비공개 글은 운영자에게만 보임
    if (!notice.isOwner) {
      postsQuery = postsQuery.eq('is_private', false);
    }

    const postsResult = await postsQuery.order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);

    if (postsResult.error) {
      return Response.json({ error: '공지를 불러오지 못했습니다.' }, { status: 500 });
    }

    const posts = (postsResult.data ?? []) as NoticePostRow[];
    const authorMap = await getAuthorMap(notice.siteId, [...new Set(posts.map((post) => post.author_id))]);

    return Response.json({
      boardLabel: notice.board.board_label,
      isOwner: notice.isOwner,
      page,
      pageSize: PAGE_SIZE,
      totalCount: postsResult.count ?? 0,
      posts: posts.map((post) => ({
        id: post.id,
        content: post.content,
        imageUrl: r2Storage.from('notice').getPublicUrl(post.image_src ?? '').data.publicUrl || null,
        isPrivate: post.is_private,
        createdAt: post.created_at,
        updatedAt: post.updated_at,
        authorName: authorMap.get(post.author_id)?.name ?? '알 수 없음',
        authorAvatarUrl: authorMap.get(post.author_id)?.avatarUrl ?? null,
      })),
    });
  } catch (unknownError) {
    const message = unknownError instanceof Error ? unknownError.message : '';
    return Response.json({ error: message || '공지를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { siteName } = await context.params;
    const notice = await getNoticeContext(siteName);

    if (!notice || !notice.isAvailable || !notice.board) {
      return Response.json({ error: '공지 게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!notice.isOwner || !notice.stigmaId) {
      return Response.json({ error: '블로그 운영자만 공지를 작성할 수 있습니다.' }, { status: 403 });
    }

    const formData = await request.formData();
    const rawContent = formData.get('content');
    const content = normalizeText(typeof rawContent === 'string' ? rawContent : '');
    const image = formData.get('image');
    const imageFile = image instanceof File && image.size > 0 ? image : null;

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

    const supabaseAdmin = getSupabaseAdmin();
    const postResult = await supabaseAdmin
      .from('notice_posts')
      .insert({
        site_id: notice.siteId,
        board_id: notice.board.id,
        author_id: notice.stigmaId,
        content,
      })
      .select('id')
      .single();

    if (postResult.error || !postResult.data) {
      return Response.json({ error: '공지를 등록하지 못했습니다.' }, { status: 500 });
    }

    let imageUploadError = false;

    if (imageFile) {
      try {
        const webp = await sharp(Buffer.from(await imageFile.arrayBuffer()))
          .webp({ quality: 90 })
          .toBuffer();
        const path = getNoticeImagePath(notice.siteId, postResult.data.id);
        const upload = await r2Storage.from('notice').upload(path, webp, { contentType: 'image/webp', upsert: false });

        if (upload.error) {
          throw new Error(upload.error.message);
        }

        const imageSrc = r2Storage.from('notice').getPublicUrl(path).data.publicUrl;
        const updateResult = await supabaseAdmin
          .from('notice_posts')
          .update({ image_src: imageSrc })
          .eq('id', postResult.data.id);

        if (updateResult.error) {
          await r2Storage.from('notice').remove([path]);
          throw new Error(updateResult.error.message);
        }
      } catch (uploadError) {
        // 글은 등록됐으므로 응답은 성공으로 두고, 원인은 서버 로그로 남김
        console.error('[notice] 이미지 업로드 실패', uploadError);
        imageUploadError = true;
      }
    }

    return Response.json({ ok: true, id: postResult.data.id, imageUploadError });
  } catch (unknownError) {
    const message = unknownError instanceof Error ? unknownError.message : '';
    return Response.json({ error: message || '공지를 등록하지 못했습니다.' }, { status: 500 });
  }
}
