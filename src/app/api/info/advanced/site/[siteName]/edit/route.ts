import { getCommunityManagerAccess } from '@/lib/community-manager/utils';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

type RequestBody = {
  visibilityMember?: string | null;
  searchKeywords?: string | null;
};

function normalizeSearchKeywords(rawValue: string) {
  const cleanedValue = rawValue.replace(/[^\p{L}\p{N}\s,]/gu, '');

  return cleanedValue
    .split(',')
    .map((keyword) => keyword.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join(', ');
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

    const requestBody = (await request.json()) as RequestBody;

    const visibilityMember = normalizeText(requestBody.visibilityMember);
    const normalizedSearchKeywords = normalizeSearchKeywords(normalizeText(requestBody.searchKeywords));

    if (visibilityMember !== 'public' && visibilityMember !== 'private') {
      return Response.json({ error: '멤버 목록 공개여부 값이 올바르지 않습니다.' }, { status: 400 });
    }

    const access = await checkAccess(normalizedSiteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const currentSites = await access.supabaseAdmin
      .from('sites')
      .select('site_id, visibility_member, search_keywords')
      .eq('site_id', access.siteId)
      .maybeSingle();

    if (currentSites.error) {
      return Response.json({ error: 'sites 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!currentSites.data) {
      return Response.json({ error: 'sites 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const previousVisibilityMember = normalizeText(currentSites.data.visibility_member);
    const previousSearchKeywords = normalizeText(currentSites.data.search_keywords);

    const isVisibilityChanged = previousVisibilityMember !== visibilityMember;
    const isSearchKeywordsChanged = previousSearchKeywords !== normalizedSearchKeywords;

    let logMessage: string | null = null;

    if (isVisibilityChanged && isSearchKeywordsChanged) {
      logMessage = '멤버 목록 공개여부, 검색용 키워드 변경';
    } else if (isVisibilityChanged) {
      logMessage = '멤버 목록 공개여부 변경';
    } else if (isSearchKeywordsChanged) {
      logMessage = '검색용 키워드 변경';
    }

    const updateResult = await access.supabaseAdmin
      .from('sites')
      .update({
        visibility_member: visibilityMember,
        search_keywords: normalizedSearchKeywords || null,
        updated_at: new Date().toISOString(),
        updated_by: access.updatedByStigmaId,
        log: logMessage,
      })
      .eq('site_id', access.siteId);

    if (updateResult.error) {
      return Response.json({ error: 'sites 정보 수정에 실패했습니다.' }, { status: 500 });
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
