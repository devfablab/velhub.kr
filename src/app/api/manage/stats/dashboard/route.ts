import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SiteType = 'blog' | 'community';

type RhizomeRow = {
  id: string;
  site_key: string;
  site_label: string | null;
  site_type: string;
};

type SiteStatsRow = {
  id: string;
  visit_count: number | string | null;
};

type VisitRow = {
  created_at: string | null;
  last_visited_at: string | null;
};

type PopularPostRow = {
  id: string;
  slug: number | string;
  subject: string | null;
  post_count: number | string | null;
  published_at: string | null;
  board_id: string | null;
};

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string | null;
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const POPULAR_POST_LIMIT = 10;

function isSiteType(value: string | null | undefined): value is SiteType {
  return value === 'blog' || value === 'community';
}

function getKstStartOfToday() {
  const now = new Date();
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const utcTime = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()) - KST_OFFSET_MS;

  return new Date(utcTime);
}

function getDateBefore(days: number) {
  return new Date(Date.now() - days * ONE_DAY_MS);
}

function getNumber(value: number | string | null | undefined) {
  return Number(value ?? 0) || 0;
}

function isRevisit(createdAt: string | null, lastVisitedAt: string | null) {
  if (!createdAt || !lastVisitedAt) {
    return false;
  }

  const createdTime = new Date(createdAt).getTime();
  const lastVisitedTime = new Date(lastVisitedAt).getTime();

  if (Number.isNaN(createdTime) || Number.isNaN(lastVisitedTime)) {
    return false;
  }

  return lastVisitedTime - createdTime >= ONE_DAY_MS;
}

async function getVisitRows(siteId: string, from = 0): Promise<VisitRow[]> {
  const supabaseAdmin = getSupabaseAdmin();
  const to = from + 999;

  const visitResult = await supabaseAdmin
    .from('site_visits')
    .select('created_at, last_visited_at')
    .eq('site_id', siteId)
    .range(from, to);

  if (visitResult.error) {
    throw new Error('재방문 정보를 불러오지 못했습니다.');
  }

  const rows = (visitResult.data ?? []) as VisitRow[];

  if (rows.length < 1000) {
    return rows;
  }

  const nextRows = await getVisitRows(siteId, to + 1);

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

  if (session.case !== 'staff') {
    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } as const;
  }

  if (!isSiteType(rhizome.site_type)) {
    return {
      ok: false,
      status: 400,
      error: '사이트 유형이 유효하지 않습니다.',
    } as const;
  }

  return {
    ok: true,
    supabaseAdmin,
    rhizome,
    siteType: rhizome.site_type,
  } as const;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await getStatsAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const todayStart = getKstStartOfToday();
    const weekStart = getDateBefore(7);
    const monthStart = getDateBefore(30);

    const siteStatsResult = await access.supabaseAdmin
      .from('sites')
      .select('id, visit_count')
      .eq('site_id', access.rhizome.id)
      .maybeSingle();

    if (siteStatsResult.error || !siteStatsResult.data) {
      return Response.json({ error: '접속 통계 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const siteStats = siteStatsResult.data as SiteStatsRow;

    const todayVisitorsResult = await access.supabaseAdmin
      .from('site_visits')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', siteStats.id)
      .gte('last_visited_at', todayStart.toISOString());

    if (todayVisitorsResult.error) {
      return Response.json({ error: '오늘 접속자 수를 불러오지 못했습니다.' }, { status: 500 });
    }

    const weekVisitorsResult = await access.supabaseAdmin
      .from('site_visits')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', siteStats.id)
      .gte('last_visited_at', weekStart.toISOString());

    if (weekVisitorsResult.error) {
      return Response.json({ error: '일주일간 접속자 수를 불러오지 못했습니다.' }, { status: 500 });
    }

    const monthVisitorsResult = await access.supabaseAdmin
      .from('site_visits')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', siteStats.id)
      .gte('last_visited_at', monthStart.toISOString());

    if (monthVisitorsResult.error) {
      return Response.json({ error: '30일간 접속자 수를 불러오지 못했습니다.' }, { status: 500 });
    }

    const responseBody = {
      site: {
        siteName: access.rhizome.site_key,
        siteLabel: access.rhizome.site_label,
        siteType: access.siteType,
      },
      visits: {
        today: todayVisitorsResult.count ?? 0,
        week: weekVisitorsResult.count ?? 0,
        month: monthVisitorsResult.count ?? 0,
        total: getNumber(siteStats.visit_count),
      },
      community: null as null | {
        todayJoin: {
          approved: number;
          unapproved: number;
          total: number;
        };
        approvedJoin: {
          week: number;
          month: number;
          total: number;
        };
        inactiveMembers: {
          week: number;
          month: number;
        };
      },
      blog: null as null | {
        popularPosts: {
          id: string;
          slug: string;
          subject: string;
          postCount: number;
          publishedAt: string | null;
          boardKey: string | null;
          boardLabel: string | null;
        }[];
        revisit: {
          totalVisitors: number;
          revisitVisitors: number;
          rate: number;
        };
      },
    };

    if (access.siteType === 'community') {
      const todayApprovedJoinResult = await access.supabaseAdmin
        .from('rhizome_stigmas')
        .select('*', { count: 'exact', head: true })
        .eq('site_id', access.rhizome.id)
        .eq('is_approval', true)
        .gte('created_at', todayStart.toISOString());

      if (todayApprovedJoinResult.error) {
        return Response.json({ error: '오늘 승인 가입자 수를 불러오지 못했습니다.' }, { status: 500 });
      }

      const todayUnapprovedJoinResult = await access.supabaseAdmin
        .from('rhizome_stigmas')
        .select('*', { count: 'exact', head: true })
        .eq('site_id', access.rhizome.id)
        .eq('is_approval', false)
        .gte('created_at', todayStart.toISOString());

      if (todayUnapprovedJoinResult.error) {
        return Response.json({ error: '오늘 비승인 가입자 수를 불러오지 못했습니다.' }, { status: 500 });
      }

      const todayTotalJoinResult = await access.supabaseAdmin
        .from('rhizome_stigmas')
        .select('*', { count: 'exact', head: true })
        .eq('site_id', access.rhizome.id)
        .gte('created_at', todayStart.toISOString());

      if (todayTotalJoinResult.error) {
        return Response.json({ error: '오늘 신규 가입자 수를 불러오지 못했습니다.' }, { status: 500 });
      }

      const weekApprovedJoinResult = await access.supabaseAdmin
        .from('rhizome_stigmas')
        .select('*', { count: 'exact', head: true })
        .eq('site_id', access.rhizome.id)
        .eq('is_approval', true)
        .gte('created_at', weekStart.toISOString());

      if (weekApprovedJoinResult.error) {
        return Response.json({ error: '일주일간 가입자 수를 불러오지 못했습니다.' }, { status: 500 });
      }

      const monthApprovedJoinResult = await access.supabaseAdmin
        .from('rhizome_stigmas')
        .select('*', { count: 'exact', head: true })
        .eq('site_id', access.rhizome.id)
        .eq('is_approval', true)
        .gte('created_at', monthStart.toISOString());

      if (monthApprovedJoinResult.error) {
        return Response.json({ error: '30일간 가입자 수를 불러오지 못했습니다.' }, { status: 500 });
      }

      const totalApprovedJoinResult = await access.supabaseAdmin
        .from('rhizome_stigmas')
        .select('*', { count: 'exact', head: true })
        .eq('site_id', access.rhizome.id)
        .eq('is_approval', true);

      if (totalApprovedJoinResult.error) {
        return Response.json({ error: '총 가입자 수를 불러오지 못했습니다.' }, { status: 500 });
      }

      const inactiveWeekResult = await access.supabaseAdmin
        .from('rhizome_stigmas')
        .select('*', { count: 'exact', head: true })
        .eq('site_id', access.rhizome.id)
        .eq('is_approval', true)
        .lt('last_checkin_at', weekStart.toISOString());

      if (inactiveWeekResult.error) {
        return Response.json({ error: '일주일 이상 미접속 유저 수를 불러오지 못했습니다.' }, { status: 500 });
      }

      const inactiveMonthResult = await access.supabaseAdmin
        .from('rhizome_stigmas')
        .select('*', { count: 'exact', head: true })
        .eq('site_id', access.rhizome.id)
        .eq('is_approval', true)
        .lt('last_checkin_at', monthStart.toISOString());

      if (inactiveMonthResult.error) {
        return Response.json({ error: '30일 이상 미접속 유저 수를 불러오지 못했습니다.' }, { status: 500 });
      }

      responseBody.community = {
        todayJoin: {
          approved: todayApprovedJoinResult.count ?? 0,
          unapproved: todayUnapprovedJoinResult.count ?? 0,
          total: todayTotalJoinResult.count ?? 0,
        },
        approvedJoin: {
          week: weekApprovedJoinResult.count ?? 0,
          month: monthApprovedJoinResult.count ?? 0,
          total: totalApprovedJoinResult.count ?? 0,
        },
        inactiveMembers: {
          week: inactiveWeekResult.count ?? 0,
          month: inactiveMonthResult.count ?? 0,
        },
      };
    }

    if (access.siteType === 'blog') {
      const popularPostsResult = await access.supabaseAdmin
        .from('posts')
        .select('id, slug, subject, post_count, published_at, board_id')
        .eq('site_id', access.rhizome.id)
        .eq('published_status', 'published')
        .or('is_closed.is.null,is_closed.eq.false')
        .order('post_count', { ascending: false, nullsFirst: false })
        .limit(POPULAR_POST_LIMIT);

      if (popularPostsResult.error) {
        return Response.json({ error: '인기글 정보를 불러오지 못했습니다.' }, { status: 500 });
      }

      const popularPosts = (popularPostsResult.data ?? []) as PopularPostRow[];
      const boardIds = [
        ...new Set(popularPosts.map((post) => post.board_id).filter((boardId): boardId is string => Boolean(boardId))),
      ];

      const boardsResult =
        boardIds.length > 0
          ? await access.supabaseAdmin.from('boards').select('id, board_key, board_label').in('id', boardIds)
          : null;

      if (boardsResult?.error) {
        return Response.json({ error: '게시판 정보를 불러오지 못했습니다.' }, { status: 500 });
      }

      const boards = ((boardsResult?.data ?? []) as BoardRow[]).reduce<Record<string, BoardRow>>(
        (accumulator, board) => {
          return {
            ...accumulator,
            [board.id]: board,
          };
        },
        {},
      );

      const visitRows = await getVisitRows(siteStats.id);
      const revisitVisitors = visitRows.filter((visit) => isRevisit(visit.created_at, visit.last_visited_at)).length;
      const totalVisitors = visitRows.length;

      responseBody.blog = {
        popularPosts: popularPosts.map((post) => {
          const board = post.board_id ? boards[post.board_id] : null;

          return {
            id: post.id,
            slug: String(post.slug),
            subject: post.subject ?? '',
            postCount: getNumber(post.post_count),
            publishedAt: post.published_at,
            boardKey: board?.board_key ?? null,
            boardLabel: board?.board_label ?? null,
          };
        }),
        revisit: {
          totalVisitors,
          revisitVisitors,
          rate: totalVisitors > 0 ? Math.round((revisitVisitors / totalVisitors) * 1000) / 10 : 0,
        },
      };
    }

    return Response.json(responseBody);
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '통계 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '통계 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
