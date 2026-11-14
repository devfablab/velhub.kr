import { getSiteMemberState } from '@/lib/session/siteMember.server';
import { getCurrentStigma } from '@/lib/session/utils';
import { normalizeText } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();
    const currentStigma = siteName ? await getCurrentStigma() : null;
    const state = await getSiteMemberState(siteName, currentStigma);

    return Response.json(state.body, { status: state.status });
  } catch (unknownError) {
    const message =
      unknownError instanceof Error && unknownError.message ? unknownError.message : '권한 확인에 실패했습니다.';

    return Response.json({ ok: false, status: 500, error: message }, { status: 500 });
  }
}
