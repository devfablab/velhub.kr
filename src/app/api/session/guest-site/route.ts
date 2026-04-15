import { getCurrentStigma, getRhizomeStigma, getSiteByName, getSitePathKind } from '@/lib/session/utils';
import { normalizeText } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();
    const pathname = normalizeText(requestUrl.searchParams.get('pathname'));

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!pathname) {
      return Response.json({ error: 'pathname이 유효하지 않습니다.' }, { status: 400 });
    }

    const stigma = await getCurrentStigma();

    if (!stigma) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (stigma.role === 'admin') {
      return Response.json({ error: '가입되지 않은 사용자 케이스가 아닙니다.' }, { status: 400 });
    }

    const site = await getSiteByName(siteName);

    if (!site) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const rhizomeStigma = await getRhizomeStigma(site.id, stigma.stigmaId);

    if (rhizomeStigma) {
      return Response.json({ error: '가입되지 않은 사용자 케이스가 아닙니다.' }, { status: 400 });
    }

    const pathKind = getSitePathKind(pathname, siteName);

    if (pathKind === 'home' || pathKind === 'board' || pathKind === 'join') {
      return Response.json({
        ok: true,
        allow: true,
        redirectTo: null,
        siteId: site.id,
        stigmaId: stigma.stigmaId,
        role: null,
      });
    }

    return Response.json({
      ok: true,
      allow: false,
      redirectTo: `/${siteName}/join`,
      siteId: site.id,
      stigmaId: stigma.stigmaId,
      role: null,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '세션 확인에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '세션 확인에 실패했습니다.' }, { status: 500 });
  }
}
