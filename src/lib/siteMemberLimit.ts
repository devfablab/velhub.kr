import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SiteMemberLimitStatus = {
  currentCount: number;
  limit: number;
};

function normalizeMemberLimit(value: unknown) {
  const parsedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value.replaceAll(',', '').trim())
        : NaN;

  if (!Number.isFinite(parsedValue)) {
    throw new Error('요금제 회원 수 제한이 올바르지 않습니다.');
  }

  return Math.max(0, Math.floor(parsedValue));
}

export async function getSiteMemberLimitStatus(siteId: string): Promise<SiteMemberLimitStatus> {
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
  const siteType = normalizeText(siteResult.data.site_type);

  if (!planId || !siteType) {
    throw new Error('사이트 요금제 정보가 올바르지 않습니다.');
  }

  const planResult = await supabaseAdmin
    .from('plans')
    .select('id')
    .eq('id', planId)
    .eq('category_key', siteType)
    .maybeSingle();

  if (planResult.error || !planResult.data) {
    throw new Error('사이트 요금제를 확인하지 못했습니다.');
  }

  const featureResult = await supabaseAdmin
    .from('plan_features')
    .select('count_user')
    .eq('plan_id', planResult.data.id)
    .maybeSingle();

  if (featureResult.error || !featureResult.data) {
    throw new Error('요금제 회원 수 제한을 확인하지 못했습니다.');
  }

  const memberCountResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('*', { count: 'exact', head: true })
    .eq('site_id', normalizedSiteId)
    .eq('is_approval', true);

  if (memberCountResult.error) {
    throw new Error('현재 회원 수를 확인하지 못했습니다.');
  }

  return {
    currentCount: memberCountResult.count ?? 0,
    limit: normalizeMemberLimit(featureResult.data.count_user),
  };
}
