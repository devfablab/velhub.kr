import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { normalizeText } from '@/lib/utils';

const SEARCH_HISTORY_LIMIT = 10;
const KEYWORD_MAX_LENGTH = 100;

export async function getSearchHistories(stigmaId: string, siteId: string | null) {
  const supabaseAdmin = getSupabaseAdmin();
  const historyQuery = supabaseAdmin.from('site_search_histories').select('keyword').eq('stigma_id', stigmaId);
  const historyResult = await (siteId ? historyQuery.eq('site_id', siteId) : historyQuery.is('site_id', null))
    .order('searched_at', { ascending: false })
    .limit(SEARCH_HISTORY_LIMIT);

  if (historyResult.error) {
    throw new Error('최근 검색어를 불러오지 못했습니다.');
  }

  return (historyResult.data ?? []).map((history) => history.keyword as string);
}

export function normalizeSearchKeyword(keyword: unknown) {
  return normalizeText(typeof keyword === 'string' ? keyword : '').slice(0, KEYWORD_MAX_LENGTH);
}

export async function saveSearchHistory(stigmaId: string, siteId: string | null, keyword: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const upsertResult = await supabaseAdmin.from('site_search_histories').upsert(
    {
      stigma_id: stigmaId,
      site_id: siteId,
      keyword,
      searched_at: new Date().toISOString(),
    },
    { onConflict: 'stigma_id,site_id,keyword' },
  );

  if (upsertResult.error) {
    throw new Error('최근 검색어를 저장하지 못했습니다.');
  }

  const overflowQuery = supabaseAdmin.from('site_search_histories').select('id').eq('stigma_id', stigmaId);
  const overflowResult = await (siteId ? overflowQuery.eq('site_id', siteId) : overflowQuery.is('site_id', null))
    .order('searched_at', { ascending: false })
    .range(SEARCH_HISTORY_LIMIT, SEARCH_HISTORY_LIMIT + 50);

  const overflowIds = (overflowResult.data ?? []).map((history) => history.id as string);

  if (overflowIds.length > 0) {
    await supabaseAdmin.from('site_search_histories').delete().in('id', overflowIds);
  }

  return getSearchHistories(stigmaId, siteId);
}
