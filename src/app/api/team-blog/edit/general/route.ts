import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RequestBody = {
  siteName: string | null;
  memberGeneralId: string | null;
  nameKo?: string | null;
  nameEn?: string | null;
  descriptionKo?: string | null;
  descriptionEn?: string | null;
  startWorkDate?: string | null;
  job?: string | null;
};

function normalizeDateValue(value: unknown) {
  const normalizedValue = typeof value === 'string' ? normalizeText(value) : '';

  if (!normalizedValue) {
    return null;
  }

  return normalizedValue;
}

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as RequestBody;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const memberGeneralId = normalizeText(requestBody.memberGeneralId);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!memberGeneralId) {
      return Response.json({ error: 'memberGeneralId가 유효하지 않습니다.' }, { status: 400 });
    }

    const nameKo = normalizeText(requestBody.nameKo);
    const nameEn = normalizeText(requestBody.nameEn);
    const descriptionKo = normalizeText(requestBody.descriptionKo);
    const descriptionEn = normalizeText(requestBody.descriptionEn);
    const startWorkDate = normalizeDateValue(requestBody.startWorkDate);
    const job = normalizeText(requestBody.job);

    if (!nameKo && !nameEn) {
      return Response.json({ error: '국문명 또는 영문명 중 하나는 입력해주세요.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin.from('rhizomes').select('id, site_type').eq('site_key', siteName).maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (rhizome.data.site_type !== 'blog') {
      return Response.json({ error: '블로그에서만 사용할 수 있습니다.' }, { status: 400 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (!session.rhizomeStigmaId || (session.case !== 'staff' && session.case !== 'member')) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const existing = await supabaseAdmin
      .from('member_general')
      .select('id, member_id')
      .eq('id', memberGeneralId)
      .eq('site_id', rhizome.data.id)
      .maybeSingle();

    if (existing.error || !existing.data) {
      return Response.json({ error: '팀원 기본 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (existing.data.member_id !== session.rhizomeStigmaId) {
      return Response.json({ error: '본인 정보만 수정할 수 있습니다.' }, { status: 403 });
    }

    const updateGeneral = await supabaseAdmin
      .from('member_general')
      .update({
        name_ko: nameKo || null,
        name_en: nameEn || null,
        description_ko: descriptionKo || null,
        description_en: descriptionEn || null,
        start_work_date: startWorkDate,
        job: job || null,
      })
      .eq('id', memberGeneralId)
      .eq('site_id', rhizome.data.id)
      .select(
        'id, created_at, name_ko, name_en, description_ko, description_en, start_work_date, job, member_id, site_id',
      )
      .maybeSingle();

    if (updateGeneral.error || !updateGeneral.data) {
      return Response.json({ error: '팀원 기본 정보 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      memberGeneral: updateGeneral.data,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '팀원 기본 정보 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '팀원 기본 정보 수정에 실패했습니다.' }, { status: 500 });
  }
}
