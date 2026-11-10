import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { getCommunityManagerAccess } from '@/lib/service/community/communityManager/utils';
import verifySession from '@/lib/session/verifySession';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

type RequestBody = {
  searchKeywords?: string | null;
  googleAnalytics?: string | null;
  googleSearch?: string | null;
};

const GOOGLE_ANALYTICS_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;

function normalizeSearchKeywords(rawValue: string) {
  const cleanedValue = rawValue.replace(/[^\p{L}\p{N}\s,]/gu, '');

  return cleanedValue
    .split(',')
    .map((keyword) => keyword.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join(', ');
}

function hasInvalidSearchKeywordCharacters(rawValue: string) {
  return /[^\p{L}\p{N}\s,]/u.test(rawValue);
}

function normalizeGoogleAnalyticsMeasurementId(rawValue: string) {
  return rawValue.trim().toUpperCase();
}

async function checkAccess(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const rhizome = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_type')
    .eq('site_key', siteName)
    .maybeSingle();

  if (rhizome.error) {
    return {
      ok: false,
      status: 500,
      error: '사이트를 찾을 수 없습니다.',
    } as const;
  }

  if (!rhizome.data) {
    return {
      ok: false,
      status: 404,
      error: '사이트를 찾을 수 없습니다.',
    } as const;
  }

  if (rhizome.data.site_type === 'community') {
    try {
      const access = await getCommunityManagerAccess(siteName);

      if (!access.actor.permissions.site_edit) {
        return {
          ok: false,
          status: 403,
          error: '접근 권한이 없습니다.',
        } as const;
      }

      return {
        ok: true,
        status: 200,
        supabaseAdmin,
        siteId: rhizome.data.id,
        updatedByStigmaId: access.actor.stigmaId,
      } as const;
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        return {
          ok: false,
          status: 403,
          error: unknownError.message || '접근 권한이 없습니다.',
        } as const;
      }

      return {
        ok: false,
        status: 403,
        error: '접근 권한이 없습니다.',
      } as const;
    }
  }

  const session = await verifySession({
    siteId: rhizome.data.id,
  });

  if (session.case === 'admin' && session.stigmaId) {
    return {
      ok: true,
      status: 200,
      supabaseAdmin,
      siteId: rhizome.data.id,
      updatedByStigmaId: session.stigmaId,
    } as const;
  }

  if (session.case !== 'staff' || !session.stigmaId || !session.rhizomeStigmaId) {
    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } as const;
  }

  const membership = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('role')
    .eq('id', session.rhizomeStigmaId)
    .eq('site_id', rhizome.data.id)
    .maybeSingle();

  if (membership.error || normalizeText(membership.data?.role) !== 'owner') {
    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } as const;
  }

  return {
    ok: true,
    status: 200,
    supabaseAdmin,
    siteId: rhizome.data.id,
    updatedByStigmaId: session.stigmaId,
  } as const;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { siteName } = await context.params;
    const normalizedSiteName = normalizeText(siteName).toLowerCase();

    if (!normalizedSiteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const requestBody = (await request.json().catch(() => null)) as RequestBody | null;
    if (!requestBody) {
      return Response.json({ error: '요청 내용을 확인할 수 없습니다.' }, { status: 400 });
    }

    const rawSearchKeywords = normalizeText(requestBody.searchKeywords);
    const normalizedSearchKeywords = normalizeSearchKeywords(rawSearchKeywords);
    const googleAnalytics = normalizeGoogleAnalyticsMeasurementId(normalizeText(requestBody.googleAnalytics));
    const googleSearch = normalizeText(requestBody.googleSearch);

    if (hasInvalidSearchKeywordCharacters(rawSearchKeywords)) {
      return Response.json({ error: '검색엔진 등록 키워드는 글자, 숫자, 쉼표만 입력해 주세요.' }, { status: 400 });
    }

    if (googleAnalytics && !GOOGLE_ANALYTICS_MEASUREMENT_ID_PATTERN.test(googleAnalytics)) {
      return Response.json(
        { error: 'Google Analytics 측정 ID는 G-로 시작하는 값으로 입력해 주세요.' },
        { status: 400 },
      );
    }

    const access = await checkAccess(normalizedSiteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const currentSites = await access.supabaseAdmin
      .from('sites')
      .select('site_id, search_keywords, google_analytics, google_search')
      .eq('site_id', access.siteId)
      .maybeSingle();

    if (currentSites.error) {
      return Response.json({ error: 'sites 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!currentSites.data) {
      return Response.json({ error: 'sites 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const previousSearchKeywords = normalizeText(currentSites.data.search_keywords);
    const previousGoogleAnalytics = normalizeText(currentSites.data.google_analytics);
    const previousGoogleSearch = normalizeText(currentSites.data.google_search);

    const isSearchKeywordsChanged = previousSearchKeywords !== normalizedSearchKeywords;
    const isGoogleAnalyticsChanged = previousGoogleAnalytics !== googleAnalytics;
    const isGoogleSearchChanged = previousGoogleSearch !== googleSearch;

    const logMessages = [
      isSearchKeywordsChanged ? '검색용 키워드 변경' : null,
      isGoogleAnalyticsChanged ? '구글 애널리틱스 적용' : null,
      isGoogleSearchChanged ? '구글 서치 콘솔 적용' : null,
    ].filter((message): message is string => Boolean(message));

    const nowIsoString = new Date().toISOString();
    const updateResult = await access.supabaseAdmin
      .from('sites')
      .update({
        search_keywords: normalizedSearchKeywords || null,
        google_analytics: googleAnalytics || null,
        google_search: googleSearch || null,
        updated_at: nowIsoString,
        updated_by: access.updatedByStigmaId,
      })
      .eq('site_id', access.siteId);

    if (updateResult.error) {
      return Response.json({ error: 'sites 정보 수정에 실패했습니다.' }, { status: 500 });
    }

    if (logMessages.length > 0) {
      const insertLogs = await access.supabaseAdmin.from('site_change_logs').insert(
        logMessages.map((log) => ({
          site_id: access.siteId,
          log,
          created_by: access.updatedByStigmaId,
          created_at: nowIsoString,
        })),
      );

      if (insertLogs.error) {
        return Response.json({ error: '수정 이력 저장에 실패했습니다.' }, { status: 500 });
      }
    }

    const refreshedSites = await access.supabaseAdmin
      .from('sites')
      .select('*')
      .eq('site_id', access.siteId)
      .maybeSingle();

    if (refreshedSites.error) {
      return Response.json({ error: '저장된 sites 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!refreshedSites.data) {
      return Response.json({ error: '저장된 sites 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    return Response.json({
      ok: true,
      sites: refreshedSites.data,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || 'sites 정보 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: 'sites 정보 수정에 실패했습니다.' }, { status: 500 });
  }
}
