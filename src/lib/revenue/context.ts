import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

export class RevenueError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'RevenueError';
    this.status = status;
  }
}

export type RevenueContext = {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  recipientUserIds: string[];
  siteId: string;
  siteName: string;
};

export type RevenueSite = {
  id: string;
  siteName: string;
  siteLabel: string;
  siteType: string | null;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label?: string | null;
  site_type?: string | null;
};

type StigmaRow = {
  id: string;
};

async function getRevenueIdentity() {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims) {
    throw new RevenueError('로그인이 필요합니다.', 401);
  }

  const supabase = getSupabaseAdmin();
  const stigmaResult = await supabase.from('stigmas').select('id').eq('user_id', sessionClaims.userId).maybeSingle();

  if (stigmaResult.error) {
    throw new RevenueError(stigmaResult.error.message, 500);
  }

  const stigma = stigmaResult.data as StigmaRow | null;

  if (!stigma) {
    throw new RevenueError('사용자 정보를 찾을 수 없습니다.', 404);
  }

  return {
    supabase,
    // 현재 결제 분배 데이터는 auth user id를 사용합니다. 이전 데이터와의 호환을 위해 stigma id도 함께 조회합니다.
    recipientUserIds: [...new Set([sessionClaims.userId, stigma.id])],
  };
}

export async function getRevenueSites(): Promise<RevenueSite[]> {
  const identity = await getRevenueIdentity();
  const splitResult = await identity.supabase
    .from('payment_splits')
    .select('site_id')
    .in('receiver_user_id', identity.recipientUserIds);

  if (splitResult.error) {
    throw new RevenueError(splitResult.error.message, 500);
  }

  const siteIds = [
    ...new Set(
      (splitResult.data ?? [])
        .map((split) => normalizeText(split.site_id))
        .filter((siteId): siteId is string => Boolean(siteId)),
    ),
  ];

  if (siteIds.length === 0) {
    return [];
  }

  const siteResult = await identity.supabase
    .from('rhizomes')
    .select('id, site_key, site_label, site_type')
    .in('id', siteIds);

  if (siteResult.error) {
    throw new RevenueError(siteResult.error.message, 500);
  }

  return ((siteResult.data ?? []) as SiteRow[])
    .map((site) => ({
      id: site.id,
      siteName: site.site_key,
      siteLabel: normalizeText(site.site_label) || site.site_key,
      siteType: normalizeText(site.site_type) || null,
    }))
    .sort((firstSite, secondSite) => firstSite.siteLabel.localeCompare(secondSite.siteLabel, 'ko-KR'));
}

export async function getRevenueContext(siteNameValue: string | null): Promise<RevenueContext> {
  const siteName = normalizeText(siteNameValue);

  if (!siteName) {
    throw new RevenueError('사이트 정보가 없습니다.', 400);
  }

  const identity = await getRevenueIdentity();
  const { supabase } = identity;

  const siteResult = await supabase.from('rhizomes').select('id, site_key').eq('site_key', siteName).maybeSingle();

  if (siteResult.error) {
    throw new RevenueError(siteResult.error.message, 500);
  }

  const site = siteResult.data as SiteRow | null;

  if (!site) {
    throw new RevenueError('사이트를 찾을 수 없습니다.', 404);
  }

  return {
    supabase,
    recipientUserIds: identity.recipientUserIds,
    siteId: site.id,
    siteName: site.site_key,
  };
}

export function getRevenueErrorResponse(error: unknown) {
  console.error(error);

  if (error instanceof RevenueError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof Error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ error: '수익/정산 정보를 불러오지 못했습니다.' }, { status: 500 });
}
