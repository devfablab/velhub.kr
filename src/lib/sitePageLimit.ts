import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SitePageLimitStatus = {
  currentCount: number;
  limit: number;
  canAddPage: boolean;
};

function normalizeSubpageLimit(value: unknown): number {
  const parsedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value.replaceAll(',', '').trim())
        : NaN;

  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Math.max(0, Math.floor(parsedValue));
}

export async function getSitePageLimitStatus(siteId: string): Promise<SitePageLimitStatus> {
  const normalizedSiteId = normalizeText(siteId);

  if (!normalizedSiteId) {
    throw new Error('사이트 정보가 올바르지 않습니다.');
  }

  const supabaseAdmin = getSupabaseAdmin();

  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_type, plan_type')
    .eq('id', normalizedSiteId)
    .maybeSingle();

  if (siteResult.error || !siteResult.data) {
    throw new Error('사이트 요금제 정보를 확인하지 못했습니다.');
  }

  const planId = normalizeText(siteResult.data.plan_type);

  if (!planId) {
    throw new Error('사이트 요금제 정보가 올바르지 않습니다.');
  }

  const featureResult = await supabaseAdmin
    .from('plan_features')
    .select('count_subpage')
    .eq('plan_id', planId)
    .maybeSingle();

  if (featureResult.error || !featureResult.data) {
    throw new Error('요금제 서브페이지 제한을 확인하지 못했습니다.');
  }

  const limit = normalizeSubpageLimit(featureResult.data.count_subpage);

  const pageCountResult = await supabaseAdmin
    .from('pages')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', normalizedSiteId);

  if (pageCountResult.error) {
    throw new Error('현재 페이지 수를 확인하지 못했습니다.');
  }

  const currentCount = pageCountResult.count ?? 0;

  return {
    currentCount,
    limit,
    canAddPage: currentCount < limit,
  };
}
