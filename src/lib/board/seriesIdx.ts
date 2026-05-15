import { getSupabaseAdmin } from '@/lib/supabase';

type SeriesIdxOptions = {
  siteId: string;
  boardId: string;
  seriesId: string | null;
};

export async function getNextSeriesIdx({ siteId, boardId, seriesId }: SeriesIdxOptions) {
  if (!seriesId) {
    return null;
  }

  const supabaseAdmin = getSupabaseAdmin();

  const latestPost = await supabaseAdmin
    .from('posts')
    .select('series_idx')
    .eq('site_id', siteId)
    .eq('board_id', boardId)
    .eq('series_id', seriesId)
    .eq('is_closed', false)
    .eq('published_status', 'published')
    .not('series_idx', 'is', null)
    .order('series_idx', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestPost.error) {
    throw new Error('연재 순서를 확인하지 못했습니다.');
  }

  const latestSeriesIdx = typeof latestPost.data?.series_idx === 'number' ? Number(latestPost.data.series_idx) : 0;

  return latestSeriesIdx + 1;
}

export async function reorderSeriesIdx({ siteId, boardId, seriesId }: SeriesIdxOptions) {
  if (!seriesId) {
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();

  const postsResult = await supabaseAdmin
    .from('posts')
    .select('id, series_idx, published_at, created_at, idx')
    .eq('site_id', siteId)
    .eq('board_id', boardId)
    .eq('series_id', seriesId)
    .eq('is_closed', false)
    .eq('published_status', 'published')
    .order('series_idx', { ascending: true, nullsFirst: false })
    .order('published_at', { ascending: true, nullsFirst: false })
    .order('idx', { ascending: true });

  if (postsResult.error) {
    throw new Error('연재 순서를 갱신하지 못했습니다.');
  }

  const posts = postsResult.data ?? [];

  await Promise.all(
    posts.map((post, index) => {
      const nextSeriesIdx = index + 1;

      if (post.series_idx === nextSeriesIdx) {
        return Promise.resolve();
      }

      return supabaseAdmin.from('posts').update({ series_idx: nextSeriesIdx }).eq('id', post.id);
    }),
  );
}
