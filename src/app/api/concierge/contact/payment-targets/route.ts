import { NextRequest } from 'next/server';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

function text(value: string | null) {
  return value?.trim() ?? '';
}

export async function GET(request: NextRequest) {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const scope = text(request.nextUrl.searchParams.get('scope'));
  const query = text(request.nextUrl.searchParams.get('q'));
  const siteId = text(request.nextUrl.searchParams.get('siteId'));
  const seriesId = text(request.nextUrl.searchParams.get('seriesId'));
  const subtype = text(request.nextUrl.searchParams.get('subtype'));
  const db = getSupabaseAdmin();

  if (scope === 'sites') {
    if (!query) return Response.json({ items: [] });
    let siteQuery = db
      .from('rhizomes')
      .select('id, site_key, site_label, site_type')
      .eq('is_shutdown', false)
      .ilike('site_label', `%${query}%`)
      .order('site_label')
      .limit(20);
    if (subtype === 'site_subscription' || subtype === 'site_donation') siteQuery = siteQuery.eq('site_type', 'blog');
    const { data, error } = await siteQuery;
    if (error) return Response.json({ error: '사이트를 검색하지 못했습니다.' }, { status: 500 });
    return Response.json({
      items: (data ?? []).map((site) => ({
        id: site.id,
        label: site.site_label || site.site_key,
        siteType: site.site_type,
      })),
    });
  }

  if (!siteId) return Response.json({ error: '사이트를 먼저 선택해 주세요.' }, { status: 400 });

  if (scope === 'series') {
    const { data, error } = await db
      .from('board_series')
      .select('id, series_key, series_label, board_id')
      .eq('site_id', siteId)
      .order('series_label')
      .limit(100);
    if (error) return Response.json({ error: '연재를 불러오지 못했습니다.' }, { status: 500 });
    return Response.json({
      items: (data ?? []).map((series) => ({
        id: series.id,
        label: series.series_label || series.series_key,
        boardId: series.board_id,
      })),
    });
  }

  if (scope === 'posts') {
    if (!seriesId || !query) return Response.json({ items: [] });
    const { data, error } = await db
      .from('posts')
      .select('id, subject, created_at, board_id')
      .eq('site_id', siteId)
      .eq('series_id', seriesId)
      .eq('published_status', 'published')
      .eq('is_closed', false)
      .ilike('subject', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return Response.json({ error: '연재글을 검색하지 못했습니다.' }, { status: 500 });
    return Response.json({
      items: (data ?? []).map((post) => ({
        id: post.id,
        label: post.subject,
        description: post.created_at,
        boardId: post.board_id,
      })),
    });
  }

  return Response.json({ error: '검색 범위를 확인해 주세요.' }, { status: 400 });
}
