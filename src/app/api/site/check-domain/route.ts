import { getCustomDomainError, normalizeCustomDomain } from '@/lib/customDomain';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

type RequestBody = {
  customDomain?: unknown;
  siteName?: unknown;
};

export async function POST(request: Request) {
  try {
    if (!(await getSessionClaims())) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });

    const body = (await request.json()) as RequestBody;
    const customDomain = normalizeCustomDomain(typeof body.customDomain === 'string' ? body.customDomain : '');
    const error = getCustomDomainError(customDomain);

    if (error) return Response.json({ ok: false, customDomain, error }, { status: 400 });

    const siteName = typeof body.siteName === 'string' ? body.siteName.trim().toLowerCase() : '';
    const result = await getSupabaseAdmin()
      .from('rhizomes')
      .select('site_key')
      .eq('custom_domain', customDomain)
      .maybeSingle();

    if (result.error) return Response.json({ error: '커스텀 도메인 확인에 실패했습니다.' }, { status: 500 });
    if (result.data && result.data.site_key !== siteName) {
      return Response.json({ ok: false, customDomain, error: '이미 사용 중인 커스텀 도메인입니다.' }, { status: 400 });
    }

    return Response.json({ ok: true, customDomain });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message || '커스텀 도메인 확인에 실패했습니다.' : '커스텀 도메인 확인에 실패했습니다.' },
      { status: 500 },
    );
  }
}
