import { isSoloBlog } from '@/lib/board/seriesAuthor';
import { getNextSeriesIdx, reorderSeriesIdx } from '@/lib/board/seriesIdx';
import { canManageCommunityBoardContents, getCommunityManagerAccess } from '@/lib/community/communityManager/utils';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type Context = { params: Promise<{ boardName: string; contentId: string }> };

async function getContext(request: Request, context: Context) {
  const { boardName, contentId } = await context.params;
  const siteName = normalizeText(new URL(request.url).searchParams.get('siteName')).toLowerCase();
  const db = getSupabaseAdmin();
  const site = await db.from('rhizomes').select('id, site_type').eq('site_key', siteName).maybeSingle();
  if (site.error || !site.data) throw new Error('사이트를 찾을 수 없습니다.');
  const session = await verifySession({ siteId: site.data.id });
  if (!session.stigmaId) throw new Error('로그인이 필요합니다.');
  const board = await db
    .from('boards')
    .select('id, board_type, post_type')
    .eq('site_id', site.data.id)
    .eq('board_key', normalizeText(boardName).toLowerCase())
    .maybeSingle();
  if (board.error || !board.data) throw new Error('게시판을 찾을 수 없습니다.');
  const query = db
    .from('posts')
    .select('id, user_id, prefix_id, series_id, series_idx, published_status, is_closed, is_locked')
    .eq('site_id', site.data.id)
    .eq('board_id', board.data.id);
  const post = /^\d+$/.test(contentId)
    ? await query.eq('slug', contentId).maybeSingle()
    : await query.eq('id', contentId).maybeSingle();
  if (post.error || !post.data) throw new Error('글을 찾을 수 없습니다.');
  let canManage = session.case === 'staff' || session.case === 'admin';
  if (site.data.site_type === 'community' && !canManage && post.data.user_id !== session.stigmaId) {
    const access = await getCommunityManagerAccess(siteName, { requireManagerControlPermission: false });
    canManage = canManageCommunityBoardContents(access.actor, board.data.id);
  }
  if (!canManage && post.data.user_id !== session.stigmaId) throw new Error('접근 권한이 없습니다.');
  if (site.data.site_type === 'blog' && post.data.user_id === session.stigmaId && !canManage) {
    const membership = await db
      .from('rhizome_stigmas')
      .select('role')
      .eq('site_id', site.data.id)
      .eq('user_id', session.stigmaId)
      .maybeSingle();
    if (membership.error || membership.data?.role !== 'member') throw new Error('접근 권한이 없습니다.');
  }
  if (post.data.is_closed || post.data.is_locked || ['page', 'youtube'].includes(board.data.board_type))
    throw new Error('설정을 변경할 수 없는 글입니다.');
  const soloBlog = await isSoloBlog({ supabaseAdmin: db, siteId: site.data.id, siteType: site.data.site_type });
  return { soloBlog, db, site: site.data, board: board.data, post: post.data, session };
}

export async function GET(request: Request, context: Context) {
  try {
    const { db, site, board, post, session, soloBlog } = await getContext(request, context);
    const [prefixes, series] = await Promise.all([
      db.from('board_prefixes').select('id, prefix_label').eq('site_id', site.id).eq('board_id', board.id),
      db
        .from('board_series')
        .select('id, series_key, series_label, is_completed, is_subscription, user_id')
        .eq('site_id', site.id)
        .eq('board_id', board.id),
    ]);
    if (prefixes.error || series.error) throw new Error('설정 목록을 불러오지 못했습니다.');
    const current = series.data.find((item) => item.id === post.series_id);
    return Response.json({
      prefixId: post.prefix_id ?? '',
      seriesKey: current?.series_key ?? '',
      prefixes: prefixes.data,
      series: series.data.filter(
        (item) =>
          item.id === post.series_id ||
          (!item.is_completed &&
            (item.user_id === session.stigmaId || (!item.user_id && soloBlog)) &&
            (!current || current.is_subscription === item.is_subscription)),
      ),
      hasSeries: Boolean(current),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '설정 목록을 불러오지 못했습니다.' },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { db, site, board, post, session, soloBlog } = await getContext(request, context);
    const body = (await request.json()) as { kind?: string; value?: string };
    const value = normalizeText(body.value);
    if (body.kind === 'prefix' && board.post_type === 'prefix') {
      if (value) {
        const prefix = await db
          .from('board_prefixes')
          .select('id')
          .eq('id', value)
          .eq('site_id', site.id)
          .eq('board_id', board.id)
          .maybeSingle();
        if (prefix.error || !prefix.data) throw new Error('말머리를 찾을 수 없습니다.');
      }
      const result = await db
        .from('posts')
        .update({ prefix_id: value || null })
        .eq('id', post.id);
      if (result.error) throw new Error('말머리 설정 저장에 실패했습니다.');
    } else if (body.kind === 'series' && ['series', 'both'].includes(board.post_type)) {
      const all = await db
        .from('board_series')
        .select('id, series_key, is_completed, is_subscription, user_id')
        .eq('site_id', site.id)
        .eq('board_id', board.id);
      if (all.error) throw new Error('연재를 불러오지 못했습니다.');
      const current = all.data.find((item) => item.id === post.series_id);
      const next = all.data.find((item) => item.series_key === value);
      if (value && !next) throw new Error('연재를 찾을 수 없습니다.');
      if (next?.id === current?.id && current) return Response.json({ ok: true });
      if (current && !next) throw new Error('연재가 연결된 글은 같은 유형의 다른 연재로만 변경할 수 있습니다.');
      if (next && (next.is_completed || (next.user_id ? next.user_id !== session.stigmaId : !soloBlog)))
        throw new Error('해당 연재를 선택할 수 없습니다.');
      if (current && next && current.is_subscription !== next.is_subscription)
        throw new Error('구독 연재와 일반 연재 사이에서는 변경할 수 없습니다.');
      const seriesId = next?.id ?? null;
      const seriesIdx =
        post.published_status === 'published'
          ? await getNextSeriesIdx({ siteId: site.id, boardId: board.id, seriesId })
          : null;
      const result = await db.from('posts').update({ series_id: seriesId, series_idx: seriesIdx }).eq('id', post.id);
      if (result.error) throw new Error('연재 설정 저장에 실패했습니다.');
      for (const id of [post.series_id, seriesId]) {
        if (id) await reorderSeriesIdx({ siteId: site.id, boardId: board.id, seriesId: id });
      }
    } else throw new Error('사용할 수 없는 설정입니다.');
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '설정을 저장하지 못했습니다.' },
      { status: 400 },
    );
  }
}
