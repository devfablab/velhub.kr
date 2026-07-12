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
  particleId: string;
  stigmaId: string;
  siteId: string;
  siteName: string;
};

type SiteRow = {
  id: string;
  site_key: string;
};

type StigmaRow = {
  id: string;
};

export async function getRevenueContext(siteNameValue: string | null): Promise<RevenueContext> {
  const siteName = normalizeText(siteNameValue);

  if (!siteName) {
    throw new RevenueError('사이트 정보가 없습니다.', 400);
  }

  const sessionClaims = await getSessionClaims();

  if (!sessionClaims) {
    throw new RevenueError('로그인이 필요합니다.', 401);
  }

  const supabase = getSupabaseAdmin();

  const siteResult = await supabase.from('rhizomes').select('id, site_key').eq('site_key', siteName).maybeSingle();

  if (siteResult.error) {
    throw new RevenueError(siteResult.error.message, 500);
  }

  const site = siteResult.data as SiteRow | null;

  if (!site) {
    throw new RevenueError('사이트를 찾을 수 없습니다.', 404);
  }

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
    particleId: sessionClaims.userId,
    stigmaId: stigma.id,
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
