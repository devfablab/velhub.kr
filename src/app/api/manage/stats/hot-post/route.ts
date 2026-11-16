import { getSupabaseAdmin } from '@/lib/clients/supabase';
import verifySession from '@/lib/session/verifySession';
import { normalizeText } from '@/lib/utils';

type RangeType = 'today' | 'week' | 'month' | 'three-months' | 'six-months' | 'year' | 'custom';

type RhizomeRow = {
  id: string;
  site_key: string;
  site_label: string | null;
  site_type: string;
};

type ReadRow = {
  post_id: string | null;
};

type PostRow = {
  id: string;
  slug: number | string;
  subject: string | null;
  board_id: string | null;
  series_id: string | null;
};

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string | null;
};

type SiteType = 'blog' | 'community';

type SeriesRow = {
  id: string;
  series_label: string | null;
};

type DateRange = {
  start: Date;
  endExclusive: Date;
  endLabel: string | null;
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const HOT_POST_PAGE_SIZE = 100;

function isRangeType(value: string): value is RangeType {
  return (
    value === 'today' ||
    value === 'week' ||
    value === 'month' ||
    value === 'three-months' ||
    value === 'six-months' ||
    value === 'year' ||
    value === 'custom'
  );
}

function getKstDateParts(date: Date) {
  const kstDate = new Date(date.getTime() + KST_OFFSET_MS);

  return {
    year: kstDate.getUTCFullYear(),
    month: kstDate.getUTCMonth() + 1,
    day: kstDate.getUTCDate(),
  };
}

function createKstDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day) - KST_OFFSET_MS);
}

function getKstStartOfToday() {
  const today = getKstDateParts(new Date());

  return createKstDate(today.year, today.month, today.day);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * ONE_DAY_MS);
}

function addMonths(date: Date, months: number) {
  const dateParts = getKstDateParts(date);

  return createKstDate(dateParts.year, dateParts.month + months, dateParts.day);
}

function formatKstDate(date: Date) {
  const dateParts = getKstDateParts(date);
  const month = String(dateParts.month).padStart(2, '0');
  const day = String(dateParts.day).padStart(2, '0');

  return `${dateParts.year}-${month}-${day}`;
}

function parseDateText(value: string) {
  const normalizedValue = normalizeText(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    return null;
  }

  const [yearText, monthText, dayText] = normalizedValue.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = createKstDate(year, month, day);
  const dateParts = getKstDateParts(date);

  if (dateParts.year !== year || dateParts.month !== month || dateParts.day !== day) {
    return null;
  }

  return date;
}

function getPresetRange(range: Exclude<RangeType, 'custom'>): DateRange {
  const now = new Date();
  const todayStart = getKstStartOfToday();

  if (range === 'today') {
    return {
      start: todayStart,
      endExclusive: now,
      endLabel: '지금',
    };
  }

  if (range === 'week') {
    return {
      start: addDays(todayStart, -6),
      endExclusive: now,
      endLabel: '지금',
    };
  }

  if (range === 'month') {
    return {
      start: addDays(todayStart, -29),
      endExclusive: now,
      endLabel: '지금',
    };
  }

  if (range === 'three-months') {
    return {
      start: addMonths(todayStart, -3),
      endExclusive: now,
      endLabel: '지금',
    };
  }

  if (range === 'six-months') {
    return {
      start: addMonths(todayStart, -6),
      endExclusive: now,
      endLabel: '지금',
    };
  }

  return {
    start: addMonths(todayStart, -12),
    endExclusive: now,
    endLabel: '지금',
  };
}

function getCustomRange(startDate: string, endDate: string) {
  const start = parseDateText(startDate);
  const end = parseDateText(endDate);

  if (!start || !end) {
    return null;
  }

  if (end.getTime() > getKstStartOfToday().getTime() || start.getTime() > end.getTime()) {
    return null;
  }

  const endExclusive = addDays(end, 1);

  return {
    start,
    endExclusive,
    endLabel: null,
  } satisfies DateRange;
}

async function getReadRows(
  siteId: string,
  boardId: string | null,
  start: Date,
  endExclusive: Date,
  from = 0,
): Promise<ReadRow[]> {
  const supabaseAdmin = getSupabaseAdmin();
  const to = from + 999;

  const readQuery = supabaseAdmin
    .from('post_reads')
    .select('post_id')
    .eq('site_id', siteId)
    .gte('read_at', start.toISOString())
    .lt('read_at', endExclusive.toISOString());
  const readResult = await (boardId ? readQuery.eq('board_id', boardId) : readQuery).range(from, to);

  if (readResult.error) {
    throw new Error('인기글 순위를 불러오지 못했습니다.');
  }

  const rows = (readResult.data ?? []) as ReadRow[];

  if (rows.length < 1000) {
    return rows;
  }

  const nextRows = await getReadRows(siteId, boardId, start, endExclusive, to + 1);

  return [...rows, ...nextRows];
}

async function getStatsAccess(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const rhizomeResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_label, site_type')
    .eq('site_key', siteName)
    .maybeSingle();

  if (rhizomeResult.error || !rhizomeResult.data) {
    return {
      ok: false,
      status: 404,
      error: '사이트 정보를 불러오지 못했습니다.',
    } as const;
  }

  const rhizome = rhizomeResult.data as RhizomeRow;
  const session = await verifySession({ siteId: rhizome.id });

  if (session.case !== 'admin' && session.case !== 'staff') {
    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } as const;
  }

  if (rhizome.site_type !== 'blog' && rhizome.site_type !== 'community') {
    return {
      ok: false,
      status: 400,
      error: '블로그와 커뮤니티 통계만 확인할 수 있습니다.',
    } as const;
  }

  return {
    ok: true,
    supabaseAdmin,
    rhizome,
    siteType: rhizome.site_type as SiteType,
  } as const;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();
    const requestedRange = normalizeText(requestUrl.searchParams.get('range')) || 'today';
    const startDate = normalizeText(requestUrl.searchParams.get('startDate'));
    const endDate = normalizeText(requestUrl.searchParams.get('endDate'));
    const boardKey = normalizeText(requestUrl.searchParams.get('board')).toLowerCase();
    const requestedPage = Number(requestUrl.searchParams.get('page'));
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!isRangeType(requestedRange)) {
      return Response.json({ error: '기간 설정이 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await getStatsAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const dateRange = requestedRange === 'custom' ? getCustomRange(startDate, endDate) : getPresetRange(requestedRange);

    if (!dateRange) {
      return Response.json({ error: '기간 설정이 유효하지 않습니다.' }, { status: 400 });
    }

    const boardOptions: BoardRow[] = [];

    if (access.siteType === 'community') {
      const boardOptionsResult = await access.supabaseAdmin
        .from('boards')
        .select('id, board_key, board_label')
        .eq('site_id', access.rhizome.id)
        .neq('board_type', 'page')
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (boardOptionsResult.error) {
        return Response.json({ error: '게시판 정보를 불러오지 못했습니다.' }, { status: 500 });
      }

      boardOptions.push(...((boardOptionsResult.data ?? []) as BoardRow[]));
    }

    const selectedBoard =
      access.siteType === 'community' && boardKey
        ? (boardOptions.find((board) => board.board_key === boardKey) ?? null)
        : null;

    if (access.siteType === 'community' && boardKey && !selectedBoard) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    const site = {
      siteName: access.rhizome.site_key,
      siteLabel: access.rhizome.site_label,
      siteType: access.siteType,
    };
    const boardInfo = {
      boards: boardOptions.map((board) => ({ key: board.board_key, label: board.board_label || board.board_key })),
      selectedBoard: selectedBoard
        ? { key: selectedBoard.board_key, label: selectedBoard.board_label || selectedBoard.board_key }
        : null,
    };

    const readRows = await getReadRows(
      access.rhizome.id,
      selectedBoard?.id ?? null,
      dateRange.start,
      dateRange.endExclusive,
    );
    const postCountMap = readRows.reduce<Record<string, number>>((accumulator, row) => {
      if (!row.post_id) {
        return accumulator;
      }

      return {
        ...accumulator,
        [row.post_id]: (accumulator[row.post_id] ?? 0) + 1,
      };
    }, {});

    const rankedEntries = Object.entries(postCountMap).sort((current, next) => next[1] - current[1]);
    const total = rankedEntries.length;
    const lastPage = Math.max(Math.ceil(total / HOT_POST_PAGE_SIZE), 1);
    const currentPage = Math.min(page, lastPage);
    const pageStart = (currentPage - 1) * HOT_POST_PAGE_SIZE;
    const hotPostEntries = rankedEntries.slice(pageStart, pageStart + HOT_POST_PAGE_SIZE);

    const postIds = hotPostEntries.map(([postId]) => postId);

    if (postIds.length === 0) {
      return Response.json({
        site,
        ...boardInfo,
        range: {
          type: requestedRange,
          startDate: formatKstDate(dateRange.start),
          endDate: dateRange.endLabel ?? formatKstDate(addDays(dateRange.endExclusive, -1)),
          endLabel: dateRange.endLabel,
        },
        posts: [],
        page: currentPage,
        pageSize: HOT_POST_PAGE_SIZE,
        total,
      });
    }

    const postsResult = await access.supabaseAdmin
      .from('posts')
      .select('id, slug, subject, board_id, series_id')
      .eq('site_id', access.rhizome.id)
      .eq('published_status', 'published')
      .or('is_closed.is.null,is_closed.eq.false')
      .in('id', postIds);

    if (postsResult.error) {
      return Response.json({ error: '글 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const posts = (postsResult.data ?? []) as PostRow[];
    const boardIds = [
      ...new Set(posts.map((post) => post.board_id).filter((boardId): boardId is string => Boolean(boardId))),
    ];
    const seriesIds = [
      ...new Set(posts.map((post) => post.series_id).filter((seriesId): seriesId is string => Boolean(seriesId))),
    ];

    const boardsResult =
      boardIds.length > 0
        ? await access.supabaseAdmin.from('boards').select('id, board_key, board_label').in('id', boardIds)
        : null;

    if (boardsResult?.error) {
      return Response.json({ error: '게시판 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const seriesResult =
      seriesIds.length > 0
        ? await access.supabaseAdmin.from('board_series').select('id, series_label').in('id', seriesIds)
        : null;

    if (seriesResult?.error) {
      return Response.json({ error: '연재 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const boards = ((boardsResult?.data ?? []) as BoardRow[]).reduce<Record<string, BoardRow>>((accumulator, board) => {
      return {
        ...accumulator,
        [board.id]: board,
      };
    }, {});

    const series = ((seriesResult?.data ?? []) as SeriesRow[]).reduce<Record<string, SeriesRow>>(
      (accumulator, seriesItem) => {
        return {
          ...accumulator,
          [seriesItem.id]: seriesItem,
        };
      },
      {},
    );

    const postMap = posts.reduce<Record<string, PostRow>>((accumulator, post) => {
      return {
        ...accumulator,
        [post.id]: post,
      };
    }, {});

    const hotPosts = hotPostEntries
      .map(([postId, readCount], index) => {
        const post = postMap[postId];

        if (!post) {
          return null;
        }

        const board = post.board_id ? boards[post.board_id] : null;
        const seriesItem = post.series_id ? series[post.series_id] : null;

        return {
          id: post.id,
          rank: pageStart + index + 1,
          slug: String(post.slug),
          subject: post.subject ?? '',
          readCount,
          boardKey: board?.board_key ?? null,
          boardLabel: board?.board_label ?? null,
          seriesLabel: seriesItem?.series_label ?? null,
        };
      })
      .filter((post): post is NonNullable<typeof post> => Boolean(post));

    return Response.json({
      site,
      ...boardInfo,
      range: {
        type: requestedRange,
        startDate: formatKstDate(dateRange.start),
        endDate: dateRange.endLabel ?? formatKstDate(addDays(dateRange.endExclusive, -1)),
        endLabel: dateRange.endLabel,
      },
      posts: hotPosts,
      page: currentPage,
      pageSize: HOT_POST_PAGE_SIZE,
      total,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '인기글 순위를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '인기글 순위를 불러오지 못했습니다.' }, { status: 500 });
  }
}
