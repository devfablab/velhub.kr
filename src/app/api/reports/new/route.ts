import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { isGuidelineReportCategory, isReportTargetType, type ReportTargetType } from '@/lib/reports/guidelines';

type ReportRequestBody = {
  targetType?: string;
  siteName?: string;
  boardName?: string | null;
  contentId?: string | number | null;
  commentId?: string | number | null;
  reportCategory?: string;
};

type SiteRow = {
  id: string;
};

type BoardRow = {
  id: string;
  site_id: string;
};

type PostRow = {
  id: string;
  site_id: string;
  board_id: string;
};

type CommentRow = {
  id: string;
  site_id: string;
  board_id: string;
  post_id: string;
};

type PostResult = {
  data: PostRow | null;
  error: string | null;
};

type CommentResult = {
  data: CommentRow | null;
  error: string | null;
};

function getStringValue(value: string | null | undefined) {
  return value?.trim() || null;
}

function getPostSlugValue(value: string | number | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const numberValue = Number(value);

    if (Number.isFinite(numberValue)) {
      return numberValue;
    }
  }

  return null;
}

function getUuidValue(value: string | number | null | undefined) {
  if (typeof value === 'string') {
    return value.trim() || null;
  }

  return null;
}

async function getSiteId(supabase: ReturnType<typeof getSupabaseAdmin>, siteName: string) {
  const result = await supabase.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

  if (result.error) {
    console.error('[report/new] getSiteId error', result.error);
    return null;
  }

  return (result.data as SiteRow | null)?.id ?? null;
}

async function getBoardId(supabase: ReturnType<typeof getSupabaseAdmin>, siteId: string, boardName: string) {
  const result = await supabase
    .from('boards')
    .select('id, site_id')
    .eq('site_id', siteId)
    .eq('board_key', boardName)
    .maybeSingle();

  if (result.error) {
    console.error('[report/new] getBoardId error', result.error);
    return null;
  }

  return (result.data as BoardRow | null)?.id ?? null;
}

async function getPost(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  siteId: string,
  boardId: string,
  postSlug: number,
): Promise<PostResult> {
  const result = await supabase
    .from('posts')
    .select('id, site_id, board_id')
    .eq('site_id', siteId)
    .eq('board_id', boardId)
    .eq('slug', postSlug)
    .maybeSingle();

  if (result.error) {
    console.error('[report/new] getPost error', result.error);

    return {
      data: null,
      error: result.error.message,
    };
  }

  return {
    data: result.data as PostRow | null,
    error: null,
  };
}

async function getComment(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  siteId: string,
  boardId: string,
  commentId: string,
): Promise<CommentResult> {
  const result = await supabase
    .from('post_comments')
    .select('id, site_id, board_id, post_id')
    .eq('site_id', siteId)
    .eq('board_id', boardId)
    .eq('id', commentId)
    .maybeSingle();

  if (result.error) {
    console.error('[report/new] getComment error', result.error);

    return {
      data: null,
      error: result.error.message,
    };
  }

  return {
    data: result.data as CommentRow | null,
    error: null,
  };
}

function getTargetInsertValues(
  targetType: ReportTargetType,
  siteId: string,
  boardId: string | null,
  postId: string | null,
  commentId: string | null,
) {
  if (targetType === 'site') {
    return {
      target_id: siteId,
      site_id: siteId,
      board_id: null,
      post_id: null,
      comment_id: null,
    };
  }

  if (targetType === 'board' && boardId) {
    return {
      target_id: boardId,
      site_id: siteId,
      board_id: boardId,
      post_id: null,
      comment_id: null,
    };
  }

  if (targetType === 'post' && boardId && postId) {
    return {
      target_id: postId,
      site_id: siteId,
      board_id: boardId,
      post_id: postId,
      comment_id: null,
    };
  }

  if (targetType === 'comment' && boardId && postId && commentId) {
    return {
      target_id: commentId,
      site_id: siteId,
      board_id: boardId,
      post_id: postId,
      comment_id: commentId,
    };
  }

  return null;
}

export async function POST(request: Request) {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = (await request.json()) as ReportRequestBody;

  console.log('[report/new] body', body);

  if (!isReportTargetType(body.targetType)) {
    return Response.json({ error: '신고 대상이 올바르지 않습니다.' }, { status: 400 });
  }

  if (!isGuidelineReportCategory(body.reportCategory)) {
    return Response.json({ error: '신고 사유가 올바르지 않습니다.' }, { status: 400 });
  }

  const siteName = normalizeText(body.siteName);

  if (!siteName) {
    return Response.json({ error: '사이트 정보가 없습니다.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const siteId = await getSiteId(supabase, siteName);

  if (!siteId) {
    return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
  }

  const boardName = getStringValue(body.boardName);
  const postSlug = body.targetType === 'post' ? getPostSlugValue(body.contentId) : null;
  const commentId = body.targetType === 'comment' ? getUuidValue(body.commentId) : null;

  console.log('[report/new] parsed values', {
    targetType: body.targetType,
    siteName,
    siteId,
    boardName,
    postSlug,
    commentId,
  });

  const boardId =
    body.targetType === 'board' || body.targetType === 'post' || body.targetType === 'comment'
      ? boardName
        ? await getBoardId(supabase, siteId, boardName)
        : null
      : null;

  if ((body.targetType === 'board' || body.targetType === 'post' || body.targetType === 'comment') && !boardId) {
    return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
  }

  if (body.targetType === 'post' && postSlug === null) {
    return Response.json({ error: '게시물 정보가 없습니다.' }, { status: 400 });
  }

  if (body.targetType === 'comment' && !commentId) {
    return Response.json({ error: '댓글 정보가 없습니다.' }, { status: 400 });
  }

  const postResult =
    body.targetType === 'post' && boardId && postSlug !== null
      ? await getPost(supabase, siteId, boardId, postSlug)
      : { data: null, error: null };

  console.log('[report/new] postResult', postResult);

  if (postResult.error) {
    return Response.json({ error: postResult.error }, { status: 500 });
  }

  if (body.targetType === 'post' && !postResult.data) {
    return Response.json({ error: '게시물을 찾을 수 없습니다.' }, { status: 404 });
  }

  const commentResult =
    body.targetType === 'comment' && boardId && commentId
      ? await getComment(supabase, siteId, boardId, commentId)
      : { data: null, error: null };

  console.log('[report/new] commentResult', commentResult);

  if (commentResult.error) {
    return Response.json({ error: commentResult.error }, { status: 500 });
  }

  if (body.targetType === 'comment' && !commentResult.data) {
    return Response.json({ error: '댓글을 찾을 수 없습니다.' }, { status: 404 });
  }

  const targetValues = getTargetInsertValues(
    body.targetType,
    siteId,
    boardId,
    postResult.data?.id ?? commentResult.data?.post_id ?? null,
    commentResult.data?.id ?? null,
  );

  console.log('[report/new] targetValues', targetValues);

  if (!targetValues) {
    return Response.json({ error: '신고 대상 정보가 없습니다.' }, { status: 400 });
  }

  const insertResult = await supabase.from('report_guidelines').insert({
    target_type: body.targetType,
    target_id: targetValues.target_id,
    site_id: targetValues.site_id,
    board_id: targetValues.board_id,
    post_id: targetValues.post_id,
    comment_id: targetValues.comment_id,
    reporter_user_id: sessionClaims.userId,
    report_category: body.reportCategory,
  });

  if (insertResult.error) {
    console.error('[report/new] insert error', insertResult.error);
    return Response.json({ error: '신고를 접수하지 못했습니다.' }, { status: 500 });
  }

  return Response.json({ ok: true });
}
