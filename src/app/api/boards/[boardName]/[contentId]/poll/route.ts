import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
    contentId: string;
  }>;
};

type PollOptionImageRow = {
  path: string;
  url: string;
  width: number | null;
  height: number | null;
};

type PollOptionRow = {
  id: number;
  label: string;
  image: PollOptionImageRow | null;
};

type PollRow = {
  question: string;
  creator_id: string;
  anonymity?: 'anonymous' | 'named';
  endType: 'absolute' | 'relative';
  endsAt: string;
  options: PollOptionRow[];
};

type RequestBody = {
  siteName?: string | null;
  optionIndex?: number | null;
};

function isNumericSlug(value: string) {
  return /^\d+$/.test(value);
}

function isPollRow(value: unknown): value is PollRow {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const rawValue = value as {
    question?: unknown;
    creator_id?: unknown;
    endsAt?: unknown;
    options?: unknown;
  };

  return (
    typeof rawValue.question === 'string' &&
    typeof rawValue.creator_id === 'string' &&
    typeof rawValue.endsAt === 'string' &&
    Array.isArray(rawValue.options)
  );
}

function isPollEnded(endsAt: string) {
  const endDate = new Date(endsAt);

  if (Number.isNaN(endDate.getTime())) {
    return true;
  }

  return endDate.getTime() <= Date.now();
}

async function getTarget(siteName: string, boardName: string, contentId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const rhizome = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

  if (rhizome.error || !rhizome.data) {
    return {
      error: Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 }),
      data: null,
    };
  }

  const board = await supabaseAdmin
    .from('boards')
    .select('id, board_key, board_type')
    .eq('site_id', rhizome.data.id)
    .eq('board_key', boardName)
    .maybeSingle();

  if (board.error || !board.data) {
    return {
      error: Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 }),
      data: null,
    };
  }

  const postQuery = supabaseAdmin
    .from('posts')
    .select('id, user_id, site_id, board_id, poll, published_status, is_closed')
    .eq('site_id', rhizome.data.id)
    .eq('board_id', board.data.id);

  const post = isNumericSlug(contentId)
    ? await postQuery.eq('slug', Number(contentId)).maybeSingle()
    : await postQuery.eq('id', contentId).maybeSingle();

  if (post.error || !post.data) {
    return {
      error: Response.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 }),
      data: null,
    };
  }

  if (post.data.published_status !== 'published' || post.data.is_closed === true) {
    return {
      error: Response.json({ error: '투표 정보를 불러올 수 없습니다.' }, { status: 403 }),
      data: null,
    };
  }

  if (!isPollRow(post.data.poll)) {
    return {
      error: Response.json({ error: '투표가 등록된 글이 아닙니다.' }, { status: 404 }),
      data: null,
    };
  }

  return {
    error: null,
    data: {
      siteId: rhizome.data.id as string,
      boardId: board.data.id as string,
      postId: post.data.id as string,
      creatorId: post.data.poll.creator_id || (post.data.user_id as string),
      poll: post.data.poll,
    },
  };
}

async function buildPollResult({ postId, poll, voterId }: { postId: string; poll: PollRow; voterId: string | null }) {
  const supabaseAdmin = getSupabaseAdmin();

  const pollRowsResult = await supabaseAdmin.from('post_polls').select('voter_id, option_index').eq('post_id', postId);

  if (pollRowsResult.error) {
    throw new Error('투표 정보를 불러오지 못했습니다.');
  }

  const optionCountMap = new Map<number, number>();
  let selectedOptionIndex: number | null = null;

  (pollRowsResult.data ?? []).forEach((row) => {
    const optionIndex = typeof row.option_index === 'number' ? row.option_index : -1;

    if (optionIndex < 0 || optionIndex >= poll.options.length) {
      return;
    }

    optionCountMap.set(optionIndex, (optionCountMap.get(optionIndex) ?? 0) + 1);

    if (voterId && row.voter_id === voterId) {
      selectedOptionIndex = optionIndex;
    }
  });

  const totalCount = Array.from(optionCountMap.values()).reduce((sum, count) => sum + count, 0);

  return {
    total_count: totalCount,
    anonymity: poll.anonymity === 'named' ? 'named' : 'anonymous',
    selected_option_index: selectedOptionIndex,
    is_ended: isPollEnded(poll.endsAt),
    options: poll.options.map((option, optionIndex) => {
      const count = optionCountMap.get(optionIndex) ?? 0;
      const percent = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;

      return {
        id: option.id,
        option_index: optionIndex,
        label: option.label,
        image: option.image,
        count,
        percent,
        is_selected: selectedOptionIndex === optionIndex,
      };
    }),
  };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { boardName, contentId } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();
    const normalizedContentId = normalizeText(contentId);
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName || !normalizedBoardName || !normalizedContentId) {
      return Response.json({ error: '요청 값이 유효하지 않습니다.' }, { status: 400 });
    }

    const target = await getTarget(siteName, normalizedBoardName, normalizedContentId);

    if (target.error || !target.data) {
      return target.error;
    }

    const session = await verifySession({
      siteId: target.data.siteId,
    });

    const result = await buildPollResult({
      postId: target.data.postId,
      poll: target.data.poll,
      voterId: session.authUserId ?? null,
    });

    return Response.json({
      ok: true,
      ...result,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '투표 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '투표 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { boardName, contentId } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();
    const normalizedContentId = normalizeText(contentId);
    const requestBody = (await request.json()) as RequestBody;

    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const optionIndex = typeof requestBody.optionIndex === 'number' ? requestBody.optionIndex : -1;

    if (!siteName || !normalizedBoardName || !normalizedContentId) {
      return Response.json({ error: '요청 값이 유효하지 않습니다.' }, { status: 400 });
    }

    const target = await getTarget(siteName, normalizedBoardName, normalizedContentId);

    if (target.error || !target.data) {
      return target.error;
    }

    const session = await verifySession({
      siteId: target.data.siteId,
    });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요한 서비스입니다.' }, { status: 401 });
    }

    if (isPollEnded(target.data.poll.endsAt)) {
      return Response.json({ error: '종료된 투표입니다.' }, { status: 400 });
    }

    if (optionIndex < 0 || optionIndex >= target.data.poll.options.length) {
      return Response.json({ error: '투표 항목이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const existingPoll = await supabaseAdmin
      .from('post_polls')
      .select('id')
      .eq('post_id', target.data.postId)
      .eq('voter_id', session.authUserId)
      .maybeSingle();

    if (existingPoll.error) {
      return Response.json({ error: '투표 참여 여부를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!existingPoll.data) {
      const insertResult = await supabaseAdmin
        .from('post_polls')
        .insert({
          post_id: target.data.postId,
          creator_id: target.data.creatorId,
          voter_id: session.authUserId,
          option_index: optionIndex,
        })
        .select('id')
        .maybeSingle();

      if (insertResult.error || !insertResult.data) {
        return Response.json({ error: '투표에 참여하지 못했습니다.' }, { status: 500 });
      }
    }

    const result = await buildPollResult({
      postId: target.data.postId,
      poll: target.data.poll,
      voterId: session.authUserId,
    });

    return Response.json({
      ok: true,
      ...result,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '투표에 참여하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '투표에 참여하지 못했습니다.' }, { status: 500 });
  }
}
