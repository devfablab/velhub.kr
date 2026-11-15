import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { getSearchHistories, normalizeSearchKeyword, saveSearchHistory } from '@/lib/searchHistories.server';
import verifySession from '@/lib/session/verifySession';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

async function getSearchHistoryAccess(context: RouteContext) {
  const { siteName: rawSiteName } = await context.params;
  const siteName = normalizeText(rawSiteName).toLowerCase();

  if (!siteName) {
    return { ok: false, status: 400, error: 'siteName이 유효하지 않습니다.' } as const;
  }

  const siteResult = await getSupabaseAdmin().from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

  if (siteResult.error || !siteResult.data) {
    return { ok: false, status: 404, error: '사이트를 찾을 수 없습니다.' } as const;
  }

  const siteId = siteResult.data.id as string;
  const session = await verifySession({ siteId });

  return { ok: true, siteId, stigmaId: session.stigmaId } as const;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const access = await getSearchHistoryAccess(context);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    if (!access.stigmaId) {
      return Response.json({ keywords: [] });
    }

    return Response.json({ keywords: await getSearchHistories(access.stigmaId, access.siteId) });
  } catch (unknownError) {
    const message = unknownError instanceof Error ? unknownError.message : '';
    return Response.json({ error: message || '최근 검색어를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await getSearchHistoryAccess(context);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    if (!access.stigmaId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const requestBody = (await request.json()) as { keyword?: unknown };
    const keyword = normalizeSearchKeyword(requestBody.keyword);

    if (!keyword) {
      return Response.json({ error: '검색어가 유효하지 않습니다.' }, { status: 400 });
    }

    return Response.json({ keywords: await saveSearchHistory(access.stigmaId, access.siteId, keyword) });
  } catch (unknownError) {
    const message = unknownError instanceof Error ? unknownError.message : '';
    return Response.json({ error: message || '최근 검색어를 저장하지 못했습니다.' }, { status: 500 });
  }
}
