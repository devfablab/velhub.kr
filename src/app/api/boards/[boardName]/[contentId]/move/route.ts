import { getCommunityManagerAccess } from '@/lib/community/community-manager/utils';
import { getSessionClaims } from '@/lib/session';
import { getCurrentStigma } from '@/lib/session/utils';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
    contentId: string;
  }>;
};

type MoveRequestBody = {
  targetBoardKey?: string | null;
};

function isNumericSlug(value: string) {
  return /^\d+$/.test(value);
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { boardName, contentId } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();
    const normalizedContentId = normalizeText(contentId);

    if (!normalizedBoardName || !normalizedContentId) {
      return Response.json({ error: '글 정보를 확인하지 못했습니다.' }, { status: 400 });
    }

    if (!(await getSessionClaims())) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const currentStigma = await getCurrentStigma();

    if (!currentStigma) {
      return Response.json({ error: '계정 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();
    const requestBody = (await request.json()) as MoveRequestBody;
    const targetBoardKey = normalizeText(requestBody.targetBoardKey).toLowerCase();

    if (!siteName || !targetBoardKey) {
      return Response.json({ error: '이동할 게시판을 선택해주세요.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const rhizomeResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_type')
      .eq('site_key', siteName)
      .maybeSingle();

    if (rhizomeResult.error || !rhizomeResult.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (rhizomeResult.data.site_type !== 'community') {
      return Response.json({ error: '커뮤니티 글만 다른 게시판으로 이동할 수 있습니다.' }, { status: 400 });
    }

    const [session, sourceBoardResult, targetBoardResult] = await Promise.all([
      verifySession({ siteId: rhizomeResult.data.id }),
      supabaseAdmin
        .from('boards')
        .select('id, board_key, board_type')
        .eq('site_id', rhizomeResult.data.id)
        .eq('board_key', normalizedBoardName)
        .maybeSingle(),
      supabaseAdmin
        .from('boards')
        .select('id, board_key, board_label, board_type, is_active')
        .eq('site_id', rhizomeResult.data.id)
        .eq('board_key', targetBoardKey)
        .maybeSingle(),
    ]);

    if (sourceBoardResult.error || !sourceBoardResult.data) {
      return Response.json({ error: '현재 게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (targetBoardResult.error || !targetBoardResult.data) {
      return Response.json({ error: '이동할 게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    const sourceBoard = sourceBoardResult.data;
    const targetBoard = targetBoardResult.data;

    if (sourceBoard.board_key === targetBoard.board_key) {
      return Response.json({ error: '현재 게시판과 다른 게시판을 선택해주세요.' }, { status: 400 });
    }

    if (targetBoard.is_active !== true || targetBoard.board_type === 'page' || targetBoard.board_type === 'blog') {
      return Response.json({ error: '이동할 수 없는 게시판입니다.' }, { status: 400 });
    }

    const postQuery = supabaseAdmin
      .from('posts')
      .select('id, slug, user_id, series_id, is_closed')
      .eq('board_id', sourceBoard.id);
    const postResult = isNumericSlug(normalizedContentId)
      ? await postQuery.eq('slug', Number(normalizedContentId)).maybeSingle()
      : await postQuery.eq('id', normalizedContentId).maybeSingle();

    if (postResult.error || !postResult.data) {
      return Response.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
    }

    const post = postResult.data;

    if (post.series_id) {
      return Response.json({ error: '연재글은 다른 게시판으로 이동시킬 수 없습니다.' }, { status: 400 });
    }

    if (post.is_closed === true) {
      return Response.json({ error: '삭제된 글은 다른 게시판으로 이동시킬 수 없습니다.' }, { status: 400 });
    }

    const isAuthor = post.user_id === currentStigma.stigmaId;
    const isAdmin = session.case === 'admin';
    let canMoveAllBoardPosts = false;
    let canMoveManagedBoardPosts = false;

    if (!isAuthor && !isAdmin) {
      try {
        const access = await getCommunityManagerAccess(siteName, { requireManagerControlPermission: false });
        canMoveAllBoardPosts =
          access.actor.communityRoles.includes('owner') ||
          access.actor.communityRoles.includes('community-manager') ||
          access.actor.communityRoles.includes('board-manager') ||
          access.actor.permissions.all_board_post_move;
        canMoveManagedBoardPosts =
          access.actor.permissions.managed_board_post_move &&
          access.actor.managedBoardGeneralIds.includes(sourceBoard.id) &&
          access.actor.managedBoardGeneralIds.includes(targetBoard.id);
      } catch {
        canMoveAllBoardPosts = false;
        canMoveManagedBoardPosts = false;
      }
    }

    if (!isAuthor && !isAdmin && !canMoveAllBoardPosts && !canMoveManagedBoardPosts) {
      return Response.json({ error: '글을 다른 게시판으로 이동할 권한이 없습니다.' }, { status: 403 });
    }

    const updateResult = await supabaseAdmin
      .from('posts')
      .update({
        board_id: targetBoard.id,
        prefix_id: null,
      })
      .eq('id', post.id)
      .select('id, slug, board_id')
      .maybeSingle();

    if (updateResult.error || !updateResult.data) {
      return Response.json({ error: '글 이동에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      content: updateResult.data,
      targetBoard: {
        boardKey: targetBoard.board_key,
        boardLabel: targetBoard.board_label,
      },
    });
  } catch (unknownError) {
    return Response.json(
      {
        error:
          unknownError instanceof Error ? unknownError.message || '글 이동에 실패했습니다.' : '글 이동에 실패했습니다.',
      },
      { status: 500 },
    );
  }
}
