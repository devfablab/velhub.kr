import { getCurrentStigma, getRhizomeStigma, getSiteByName, getSitePathKind, normalizeText } from '@/lib/session/utils';

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

    const site = await getSiteByName(siteName);

    if (!site) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const pathKind = getSitePathKind(pathname, siteName);
    const rhizomeStigma = await getRhizomeStigma(site.id, stigma.stigmaId);

    if (!rhizomeStigma || rhizomeStigma.role !== 'member') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    if (site.isShutdown) {
      if (pathKind === 'forbidden') {
        return Response.json({
          ok: true,
          allow: true,
          redirectTo: null,
          siteId: site.id,
          stigmaId: stigma.stigmaId,
          role: rhizomeStigma.role,
        });
      }

      return Response.json({
        ok: true,
        allow: false,
        redirectTo: `/${siteName}/forbidden`,
        siteId: site.id,
        stigmaId: stigma.stigmaId,
        role: rhizomeStigma.role,
      });
    }

    if (pathKind === 'forbidden') {
      return Response.json({
        ok: true,
        allow: false,
        redirectTo: `/${siteName}`,
        siteId: site.id,
        stigmaId: stigma.stigmaId,
        role: rhizomeStigma.role,
      });
    }

    if (
      pathKind === 'home' ||
      pathKind === 'board' ||
      pathKind === 'content' ||
      pathKind === 'board_new' ||
      pathKind === 'content_edit'
    ) {
      return Response.json({
        ok: true,
        allow: true,
        redirectTo: null,
        siteId: site.id,
        stigmaId: stigma.stigmaId,
        role: rhizomeStigma.role,
      });
    }

    return Response.json({
      ok: true,
      allow: false,
      redirectTo: `/${siteName}`,
      siteId: site.id,
      stigmaId: stigma.stigmaId,
      role: rhizomeStigma.role,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '세션 확인에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '세션 확인에 실패했습니다.' }, { status: 500 });
  }
}
