import { getCommunityManagerAccess } from '@/lib/community/community-manager/utils';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

type UpdateField =
  | 'site_key'
  | 'site_label'
  | 'profile_picture'
  | 'profile_logo'
  | 'summary'
  | 'visibility_type'
  | 'theme_type'
  | 'is_shutdown';

type RequestBody = {
  field: UpdateField;
  value: string | boolean | null;
};

type ThemeType = 'default' | 'coral' | 'teal' | 'royalblue' | 'slateblue' | 'seagreen' | 'orchid' | 'tomato';

const THEME_TYPES: ThemeType[] = ['default', 'coral', 'teal', 'royalblue', 'slateblue', 'seagreen', 'orchid', 'tomato'];

function normalizeSiteKey(rawValue: string) {
  return rawValue
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
}

function hasInvalidCharacters(value: string) {
  return /[^a-z0-9-]/.test(value);
}

function isThemeType(value: unknown): value is ThemeType {
  return typeof value === 'string' && THEME_TYPES.includes(value as ThemeType);
}

function formatLogMessage(
  field: UpdateField,
  previousValue: string | boolean | null,
  nextValue: string | boolean | null,
) {
  if (field === 'site_key') {
    return `사이트 식별자 ${String(previousValue ?? '')} → ${String(nextValue ?? '')}`;
  }

  if (field === 'site_label') {
    return `사이트명 ${String(previousValue ?? '')} → ${String(nextValue ?? '')}`;
  }

  if (field === 'profile_picture') {
    return `아바타 ${String(previousValue ?? '')} → ${String(nextValue ?? '')}`;
  }

  if (field === 'profile_logo') {
    return `사이트 로고 ${String(previousValue ?? '')} → ${String(nextValue ?? '')}`;
  }

  if (field === 'summary') {
    return `요약 ${String(previousValue ?? '')} → ${String(nextValue ?? '')}`;
  }

  if (field === 'visibility_type') {
    return `공개 여부 ${String(previousValue ?? '')} → ${String(nextValue ?? '')}`;
  }

  if (field === 'theme_type') {
    return `테마 ${String(previousValue ?? '')} → ${String(nextValue ?? '')}`;
  }

  return `중단 여부 ${String(previousValue ?? '')} → ${String(nextValue ?? '')}`;
}

async function getCommunityUpdatedByParticleId(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, stigmaId: string) {
  const stigma = await supabaseAdmin.from('stigmas').select('user_id').eq('id', stigmaId).maybeSingle();

  if (stigma.error || !stigma.data?.user_id) {
    return null;
  }

  return stigma.data.user_id as string;
}

async function checkAccess(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const rhizome = await supabaseAdmin
    .from('rhizomes')
    .select(
      'id, created_at, site_key, site_label, profile_picture, profile_logo, summary, site_type, visibility_type, theme_type, is_shutdown',
    )
    .eq('site_key', siteName)
    .maybeSingle();

  if (rhizome.error || !rhizome.data) {
    return {
      ok: false,
      status: 404,
      error: '사이트를 찾을 수 없습니다.',
    } as const;
  }

  if (rhizome.data.site_type === 'community') {
    try {
      const access = await getCommunityManagerAccess(siteName);

      if (!access.actor.permissions.site_edit) {
        return {
          ok: false,
          status: 403,
          error: '접근 권한이 없습니다.',
        } as const;
      }

      const updatedByParticleId = await getCommunityUpdatedByParticleId(supabaseAdmin, access.actor.stigmaId);

      if (!updatedByParticleId) {
        return {
          ok: false,
          status: 403,
          error: '수정자 정보를 확인할 수 없습니다.',
        } as const;
      }

      return {
        ok: true,
        status: 200,
        rhizome: rhizome.data,
        updatedByParticleId,
        supabaseAdmin,
      } as const;
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        return {
          ok: false,
          status: 403,
          error: unknownError.message || '접근 권한이 없습니다.',
        } as const;
      }

      return {
        ok: false,
        status: 403,
        error: '접근 권한이 없습니다.',
      } as const;
    }
  }

  const session = await verifySession({
    siteId: rhizome.data.id,
  });

  if (session.case !== 'staff' || !session.stigmaId || !session.rhizomeStigmaId) {
    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } as const;
  }

  const membership = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('role, user_id')
    .eq('id', session.rhizomeStigmaId)
    .eq('site_id', rhizome.data.id)
    .maybeSingle();

  if (membership.error || normalizeText(membership.data?.role) !== 'owner' || !membership.data?.user_id) {
    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } as const;
  }

  const updatedByParticleId = await getCommunityUpdatedByParticleId(supabaseAdmin, membership.data.user_id);

  if (!updatedByParticleId) {
    return {
      ok: false,
      status: 403,
      error: '수정자 정보를 확인할 수 없습니다.',
    } as const;
  }

  return {
    ok: true,
    status: 200,
    rhizome: rhizome.data,
    updatedByParticleId,
    supabaseAdmin,
  } as const;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { siteName } = await context.params;
    const normalizedSiteName = normalizeText(siteName).toLowerCase();

    if (!normalizedSiteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const requestBody = (await request.json()) as RequestBody;

    const updatableFields: UpdateField[] = [
      'site_key',
      'site_label',
      'profile_picture',
      'profile_logo',
      'summary',
      'visibility_type',
      'theme_type',
      'is_shutdown',
    ];

    if (!updatableFields.includes(requestBody.field)) {
      return Response.json({ error: '수정할 수 없는 항목입니다.' }, { status: 400 });
    }

    const access = await checkAccess(normalizedSiteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const previousValue: string | boolean | null = access.rhizome[requestBody.field];
    let nextValue: string | boolean | null = null;

    if (requestBody.field === 'site_key') {
      const rawValue = typeof requestBody.value === 'string' ? requestBody.value : '';
      const normalizedValue = normalizeSiteKey(rawValue);

      if (!normalizedValue) {
        return Response.json({ error: '사이트 식별자를 입력해주세요.' }, { status: 400 });
      }

      if (hasInvalidCharacters(normalizedValue)) {
        return Response.json({ error: "영소문자, 하이픈('-'), 숫자만 사용 가능합니다." }, { status: 400 });
      }

      if (/^\d/.test(normalizedValue)) {
        return Response.json({ error: '사이트 식별자는 숫자로 시작할 수 없습니다.' }, { status: 400 });
      }

      if (normalizedValue.length < 5 || normalizedValue.length > 15) {
        return Response.json({ error: '사이트 식별자는 5자 이상 15자 이하여야 합니다.' }, { status: 400 });
      }

      const denylist = await access.supabaseAdmin
        .from('denylist')
        .select('word')
        .eq('word', normalizedValue)
        .maybeSingle();

      if (denylist.error) {
        return Response.json({ error: '사이트 식별자 확인에 실패했습니다.' }, { status: 500 });
      }

      if (denylist.data) {
        return Response.json({ error: '사용할 수 없는 사이트 식별자입니다.' }, { status: 400 });
      }

      const duplicateSiteKey = await access.supabaseAdmin
        .from('rhizomes')
        .select('id')
        .eq('site_key', normalizedValue)
        .neq('id', access.rhizome.id)
        .maybeSingle();

      if (duplicateSiteKey.error) {
        return Response.json({ error: '사이트 식별자 확인에 실패했습니다.' }, { status: 500 });
      }

      if (duplicateSiteKey.data) {
        return Response.json({ error: '사용할 수 없는 사이트 식별자입니다.' }, { status: 400 });
      }

      nextValue = normalizedValue;
    } else if (requestBody.field === 'visibility_type') {
      if (requestBody.value !== 'public' && requestBody.value !== 'private') {
        return Response.json({ error: '공개 여부 값이 올바르지 않습니다.' }, { status: 400 });
      }

      nextValue = requestBody.value;
    } else if (requestBody.field === 'theme_type') {
      if (!isThemeType(requestBody.value)) {
        return Response.json({ error: '테마 값이 올바르지 않습니다.' }, { status: 400 });
      }

      nextValue = requestBody.value;
    } else if (requestBody.field === 'is_shutdown') {
      if (typeof requestBody.value !== 'boolean') {
        return Response.json({ error: '중단 여부 값이 올바르지 않습니다.' }, { status: 400 });
      }

      nextValue = requestBody.value;
    } else {
      nextValue = typeof requestBody.value === 'string' ? requestBody.value.trim() || null : null;
    }

    const updateRhizome = await access.supabaseAdmin
      .from('rhizomes')
      .update({
        [requestBody.field]: nextValue,
      })
      .eq('id', access.rhizome.id);

    if (updateRhizome.error) {
      return Response.json({ error: '사이트 정보 수정에 실패했습니다.' }, { status: 500 });
    }

    const nowIsoString = new Date().toISOString();
    const logMessage = formatLogMessage(requestBody.field, previousValue, nextValue);

    const updateSites = await access.supabaseAdmin
      .from('sites')
      .update({
        updated_at: nowIsoString,
        updated_by: access.updatedByParticleId,
        log: logMessage,
      })
      .eq('site_id', access.rhizome.id);

    if (updateSites.error) {
      return Response.json({ error: '수정 이력 저장에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      field: requestBody.field,
      value: nextValue,
      siteName: requestBody.field === 'site_key' && typeof nextValue === 'string' ? nextValue : normalizedSiteName,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '사이트 정보 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '사이트 정보 수정에 실패했습니다.' }, { status: 500 });
  }
}
