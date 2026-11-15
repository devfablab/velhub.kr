import { getSearchHistories, normalizeSearchKeyword, saveSearchHistory } from '@/lib/searchHistories.server';
import verifySession from '@/lib/session/verifySession';

export async function GET() {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.stigmaId) {
      return Response.json({ keywords: [] });
    }

    return Response.json({ keywords: await getSearchHistories(session.stigmaId, null) });
  } catch (unknownError) {
    const message = unknownError instanceof Error ? unknownError.message : '';
    return Response.json({ error: message || '최근 검색어를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.stigmaId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const requestBody = (await request.json()) as { keyword?: unknown };
    const keyword = normalizeSearchKeyword(requestBody.keyword);

    if (!keyword) {
      return Response.json({ error: '검색어가 유효하지 않습니다.' }, { status: 400 });
    }

    return Response.json({ keywords: await saveSearchHistory(session.stigmaId, null, keyword) });
  } catch (unknownError) {
    const message = unknownError instanceof Error ? unknownError.message : '';
    return Response.json({ error: message || '최근 검색어를 저장하지 못했습니다.' }, { status: 500 });
  }
}
