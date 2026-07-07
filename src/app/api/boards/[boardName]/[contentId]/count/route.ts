import { NextResponse } from 'next/server';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { encrypt } from '@/lib/encryption/encrypt';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
    contentId: string;
  }>;
};

function isNumericSlug(value: string) {
  return /^\d+$/.test(value);
}

function getPostViewCookieName(siteKey: string, boardKey: string, idx: number) {
  return `PS_${siteKey}_${boardKey}_${String(idx)}`;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { boardName, contentId } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();
    const normalizedContentId = normalizeText(contentId);

    if (!normalizedBoardName) {
      return NextResponse.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!normalizedContentId) {
      return NextResponse.json({ error: 'contentId가 유효하지 않습니다.' }, { status: 400 });
    }

    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return NextResponse.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin
      .from('rhizomes')
      .select('id, visibility_type, is_shutdown')
      .eq('site_key', siteName)
      .maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return NextResponse.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (rhizome.data.visibility_type !== 'public' || rhizome.data.is_shutdown !== false) {
      if (session.case !== 'staff') {
        return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    const board = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_type')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return NextResponse.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (board.data.board_type === 'page') {
      return NextResponse.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
    }

    const postQuery = supabaseAdmin
      .from('posts')
      .select('id, slug, idx, user_id, is_closed, published_status, post_count')
      .eq('site_id', rhizome.data.id)
      .eq('board_id', board.data.id);

    const post = isNumericSlug(normalizedContentId)
      ? await postQuery.eq('slug', Number(normalizedContentId)).maybeSingle()
      : await postQuery.eq('id', normalizedContentId).maybeSingle();

    if (post.error || !post.data) {
      return NextResponse.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
    }

    const postCount = typeof post.data.post_count === 'number' ? Number(post.data.post_count) : 0;
    const isAuthor = Boolean(session.authUserId) && post.data.user_id === session.authUserId;

    if (
      isAuthor ||
      post.data.is_closed ||
      post.data.published_status !== 'published' ||
      typeof post.data.idx !== 'number'
    ) {
      return NextResponse.json({
        ok: true,
        postCount,
      });
    }

    const viewCookieName = getPostViewCookieName(siteName, normalizedBoardName, Number(post.data.idx));
    const alreadyViewed = request.headers
      .get('cookie')
      ?.split(';')
      .map((item) => item.trim())
      .some((item) => item.startsWith(`${viewCookieName}=`));

    if (alreadyViewed) {
      return NextResponse.json({
        ok: true,
        postCount,
      });
    }

    const updateViewResult = await supabaseAdmin
      .from('posts')
      .update({
        post_count: postCount + 1,
      })
      .eq('id', post.data.id)
      .eq('post_count', postCount)
      .select('post_count')
      .maybeSingle();

    if (updateViewResult.error || !updateViewResult.data) {
      return NextResponse.json({
        ok: true,
        postCount,
      });
    }

    const nextPostCount = Number(updateViewResult.data.post_count ?? postCount + 1);

    const response = NextResponse.json({
      ok: true,
      postCount: nextPostCount,
    });

    response.cookies.set(viewCookieName, '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return NextResponse.json({ error: unknownError.message || '조회수를 반영하지 못했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ error: '조회수를 반영하지 못했습니다.' }, { status: 500 });
  }
}
