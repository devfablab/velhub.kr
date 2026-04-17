import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RequestBody = {
  siteLabel: string | null;
};

export async function POST(request: Request) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const requestBody = (await request.json()) as RequestBody;
    const normalizedSiteLabel = normalizeText(requestBody.siteLabel);

    if (!normalizedSiteLabel) {
      return Response.json(
        {
          ok: false,
          normalizedSiteLabel: '',
          error: '사이트명을 입력해주세요.',
        },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const siteResult = await supabaseAdmin
      .from('rhizomes')
      .select('id')
      .eq('site_label', normalizedSiteLabel)
      .maybeSingle();

    if (siteResult.error) {
      return Response.json({ error: '사이트명 확인에 실패했습니다.' }, { status: 500 });
    }

    if (siteResult.data) {
      return Response.json(
        {
          ok: false,
          normalizedSiteLabel,
          error: '이미 사용 중인 사이트명입니다.',
        },
        { status: 400 },
      );
    }

    return Response.json({
      ok: true,
      normalizedSiteLabel,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '사이트명 확인에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '사이트명 확인에 실패했습니다.' }, { status: 500 });
  }
}
