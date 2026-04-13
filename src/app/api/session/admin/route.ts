import { getCurrentStigma } from '@/lib/session/utils';

export async function GET() {
  try {
    const stigma = await getCurrentStigma();

    if (!stigma) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (stigma.role !== 'admin') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    return Response.json({
      ok: true,
      allow: true,
      redirectTo: null,
      stigmaId: stigma.stigmaId,
      role: stigma.role,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '세션 확인에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '세션 확인에 실패했습니다.' }, { status: 500 });
  }
}
