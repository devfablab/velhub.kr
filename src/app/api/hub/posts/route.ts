import { NextResponse } from 'next/server';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(_: Request) {
  const page = Math.max(1, Number(new URL(_.url).searchParams.get('page') ?? '1') || 1);
  const from = (page - 1) * 20;
  
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) {
    return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const userId = currentStigma.stigmaId;

  const postsResult = await supabaseAdmin
        .from('posts')
        .select('id, site_id, board_id, series_id, subject, slug, published_at', { count: 'exact' })
        .eq('user_id', userId)
        .eq('published_status', 'published')
        .eq('is_closed', false)
        .order('published_at', { ascending: false })
        .range(from, from + 19);
        
  if (postsResult.error) return NextResponse.json({ message: '내가 쓴 글을 불러오지 못했습니다.' }, { status: 500 });

  const posts = postsResult.data ?? [];
  const [sitesResult, boardsResult, seriesResult] = await Promise.all([
    posts.length ? supabaseAdmin.from('rhizomes').select('id, site_key, site_label').in('id', [...new Set(posts.map((post) => post.site_id))]) : { data: [], error: null },
    posts.length ? supabaseAdmin.from('boards').select('id, board_key').in('id', [...new Set(posts.map((post) => post.board_id))]) : { data: [], error: null },
    posts.length ? supabaseAdmin.from('board_series').select('id, series_label').in('id', [...new Set(posts.map((post) => post.series_id).filter(Boolean))]) : { data: [], error: null }
  ]);
  
  if (sitesResult.error || boardsResult.error || seriesResult.error) return NextResponse.json({ message: '글 경로를 불러오지 못했습니다.' }, { status: 500 });
  const siteMap = new Map((sitesResult.data ?? []).map((site) => [site.id, { key: site.site_key, label: site.site_label }]));
  const boardMap = new Map((boardsResult.data ?? []).map((board) => [board.id, board.board_key]));
  const seriesMap = new Map((seriesResult.data ?? []).map((item) => [item.id, item.series_label]));

  return NextResponse.json({
    posts: posts.map((post) => ({
      id: post.id,
      subject: post.subject ?? '제목 없음',
      publishedAt: post.published_at,
      seriesLabel: seriesMap.get(post.series_id) ?? '연재',
      siteLabel: siteMap.get(post.site_id)?.label ?? '사이트',
      url: `/${siteMap.get(post.site_id)?.key ?? ''}/${boardMap.get(post.board_id) ?? ''}/${post.slug ?? ''}`,
    })),
    total: postsResult.count ?? 0,
    page,
  });
}
