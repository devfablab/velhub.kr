import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    itemType: string;
  }>;
};

type RequestBody = {
  siteName: string | null;
  itemId: string | null;
  school?: string | null;
  major?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  subject?: string | null;
  institution?: string | null;
  dateTime?: string | null;
  description?: string | null;
  client?: string | null;
  agency?: string | null;
  siteNameValue?: string | null;
  siteUrl?: string | null;
  organization?: string | null;
  teamPosition?: string | null;
  roleJob?: string | null;
  workStartDate?: string | null;
  workEndDate?: string | null;
};

type ItemType = 'educations' | 'awards' | 'projects' | 'careers';

function isItemType(value: string): value is ItemType {
  return value === 'educations' || value === 'awards' || value === 'projects' || value === 'careers';
}

function getTableName(itemType: ItemType) {
  return `member_${itemType}`;
}

function normalizeDate(value: unknown) {
  const normalizedValue = typeof value === 'string' ? normalizeText(value) : '';
  return normalizedValue || null;
}

function validateDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) {
    return true;
  }

  return new Date(startDate).getTime() <= new Date(endDate).getTime();
}

function buildPayload(itemType: ItemType, requestBody: RequestBody) {
  if (itemType === 'educations') {
    const school = normalizeText(requestBody.school);
    const startDate = normalizeDate(requestBody.startDate);
    const endDate = normalizeDate(requestBody.endDate);

    if (!school) {
      return { error: '학교명을 입력해주세요.' } as const;
    }

    if (!validateDateRange(startDate, endDate)) {
      return { error: '종료일은 시작일보다 과거일 수 없습니다.' } as const;
    }

    return {
      payload: {
        school,
        major: normalizeText(requestBody.major) || null,
        start_date: startDate,
        end_date: endDate,
      },
    } as const;
  }

  if (itemType === 'awards') {
    const subject = normalizeText(requestBody.subject);
    const institution = normalizeText(requestBody.institution);

    if (!subject) {
      return { error: '수상명을 입력해주세요.' } as const;
    }

    if (!institution) {
      return { error: '수여기관을 입력해주세요.' } as const;
    }

    return {
      payload: {
        subject,
        institution,
        date_time: normalizeDate(requestBody.dateTime),
      },
    } as const;
  }

  if (itemType === 'projects') {
    const subject = normalizeText(requestBody.subject);
    const workStartDate = normalizeDate(requestBody.workStartDate);
    const workEndDate = normalizeDate(requestBody.workEndDate);

    if (!subject) {
      return { error: '프로젝트명을 입력해주세요.' } as const;
    }

    if (!validateDateRange(workStartDate, workEndDate)) {
      return { error: '종료일은 시작일보다 과거일 수 없습니다.' } as const;
    }

    return {
      payload: {
        work_start_date: workStartDate,
        work_end_date: workEndDate,
        subject,
        description: normalizeText(requestBody.description) || null,
        client: normalizeText(requestBody.client) || null,
        agency: normalizeText(requestBody.agency) || null,
        site_name: normalizeText(requestBody.siteNameValue) || null,
        site_url: normalizeText(requestBody.siteUrl) || null,
      },
    } as const;
  }

  const organization = normalizeText(requestBody.organization);
  const teamPosition = normalizeText(requestBody.teamPosition);
  const roleJob = normalizeText(requestBody.roleJob);
  const workStartDate = normalizeDate(requestBody.workStartDate);
  const workEndDate = normalizeDate(requestBody.workEndDate);

  if (!organization) {
    return { error: '소속 단체를 입력해주세요.' } as const;
  }

  if (!teamPosition) {
    return { error: '팀명 또는 위치를 입력해주세요.' } as const;
  }

  if (!roleJob) {
    return { error: '역할 또는 직무를 입력해주세요.' } as const;
  }

  if (!validateDateRange(workStartDate, workEndDate)) {
    return { error: '종료일은 시작일보다 과거일 수 없습니다.' } as const;
  }

  return {
    payload: {
      organization,
      team_position: teamPosition,
      role_job: roleJob,
      work_start_date: workStartDate,
      work_end_date: workEndDate,
    },
  } as const;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { itemType: rawItemType } = await context.params;
    const itemType = normalizeText(rawItemType).toLowerCase();

    if (!isItemType(itemType)) {
      return Response.json({ error: '항목 유형이 유효하지 않습니다.' }, { status: 400 });
    }

    const requestBody = (await request.json()) as RequestBody;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const itemId = normalizeText(requestBody.itemId);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!itemId) {
      return Response.json({ error: 'itemId가 유효하지 않습니다.' }, { status: 400 });
    }

    const built = buildPayload(itemType, requestBody);

    if ('error' in built) {
      return Response.json({ error: built.error }, { status: 400 });
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

    const tableName = getTableName(itemType);

    const existing = await supabaseAdmin
      .from(tableName)
      .select('id, member_id')
      .eq('id', itemId)
      .eq('site_id', rhizome.data.id)
      .maybeSingle();

    if (existing.error || !existing.data) {
      return Response.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (existing.data.member_id !== session.rhizomeStigmaId) {
      return Response.json({ error: '본인 항목만 수정할 수 있습니다.' }, { status: 403 });
    }

    const updateItem = await supabaseAdmin
      .from(tableName)
      .update(built.payload)
      .eq('id', itemId)
      .eq('site_id', rhizome.data.id)
      .select('*')
      .maybeSingle();

    if (updateItem.error || !updateItem.data) {
      return Response.json({ error: '항목 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      item: {
        ...updateItem.data,
        nickname: '',
        isMine: true,
      },
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '항목 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '항목 수정에 실패했습니다.' }, { status: 500 });
  }
}
