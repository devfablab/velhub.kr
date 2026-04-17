import { getCurrentStigma } from '@/lib/session/utils';

export async function GET() {
  try {
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

    if (currentStigma.role !== 'admin') {
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
      stigmaId: currentStigma.stigmaId,
      role: currentStigma.role,
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
