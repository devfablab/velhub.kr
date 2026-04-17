import { normalizeText } from '@/lib/utils';
import { getCurrentStigma, getRhizomeStigma, getSiteByName } from '@/lib/session/utils';

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json(
        {
          ok: false,
          status: 400,
          error: 'siteName이 유효하지 않습니다.',
        },
        { status: 400 },
      );
    }

    const currentStigma = await getCurrentStigma();

    if (!currentStigma) {
      return Response.json(
        {
          ok: false,
          status: 401,
          error: '로그인이 필요합니다.',
        },
        { status: 401 },
      );
    }

    if (currentStigma.role === 'admin') {
      return Response.json({
        ok: true,
        allow: true,
        redirectTo: null,
        stigmaId: currentStigma.stigmaId,
        role: currentStigma.role,
      });
    }

    const site = await getSiteByName(siteName);

    if (!site) {
      return Response.json(
        {
          ok: false,
          status: 404,
          error: '사이트 정보를 불러오지 못했습니다.',
        },
        { status: 404 },
      );
    }

    const rhizomeStigma = await getRhizomeStigma(site.id, currentStigma.stigmaId);

    if (!rhizomeStigma) {
      return Response.json(
        {
          ok: false,
          status: 403,
          error: '접근 권한이 없습니다.',
        },
        { status: 403 },
      );
    }

    if (rhizomeStigma.role !== 'owner' && rhizomeStigma.role !== 'manager') {
      return Response.json(
        {
          ok: false,
          status: 403,
          error: '접근 권한이 없습니다.',
        },
        { status: 403 },
      );
    }

    return Response.json({
      ok: true,
      allow: true,
      redirectTo: null,
      siteId: site.id,
      stigmaId: currentStigma.stigmaId,
      role: rhizomeStigma.role,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        {
          ok: false,
          status: 500,
          error: unknownError.message || '권한 확인에 실패했습니다.',
        },
        { status: 500 },
      );
    }

    return Response.json(
      {
        ok: false,
        status: 500,
        error: '권한 확인에 실패했습니다.',
      },
      { status: 500 },
    );
  }
}
