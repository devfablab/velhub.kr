import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
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
  | 'summary'
  | 'visibility_type'
  | 'theme_type'
  | 'is_shutdown';

type RequestBody = {
  field: UpdateField;
  value: string | boolean | null;
};

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

async function checkAccess(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const rhizome = await supabaseAdmin
    .from('rhizomes')
    .select(
      'id, created_at, site_key, site_label, profile_picture, summary, site_type, visibility_type, theme_type, is_shutdown',
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

  const session = await verifySession({
    siteId: rhizome.data.id,
  });

  if (session.status === 'FAIL') {
    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } as const;
  }

  if (session.case !== 'staff') {
    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } as const;
  }

  return {
    ok: true,
    status: 200,
    rhizome: rhizome.data,
    session,
    supabaseAdmin,
  } as const;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { siteName } = await context.params;
    const normalizedSiteName = normalizeText(siteName).toLowerCase();

    if (!normalizedSiteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await checkAccess(normalizedSiteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const sites = await access.supabaseAdmin
      .from('sites')
      .select('updated_at, updated_by, log')
      .eq('site_id', access.rhizome.id)
      .maybeSingle();

    if (sites.error || !sites.data) {
      return Response.json({ error: 'sites 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    let updatedByName = '';

    if (sites.data.updated_by) {
      const nickname = await access.supabaseAdmin
        .from('rhizome_stigmas')
        .select('nickname')
        .eq('site_id', access.rhizome.id)
        .eq('user_id', sites.data.updated_by)
        .maybeSingle();

      if (nickname.data?.nickname) {
        updatedByName = nickname.data.nickname;
      } else {
        const stigmaUser = await access.supabaseAdmin
          .from('stigmas')
          .select('user_name')
          .eq('id', sites.data.updated_by)
          .maybeSingle();

        if (stigmaUser.data?.user_name) {
          updatedByName = decrypt(stigmaUser.data.user_name);
        } else {
          const fallbackStigma = await access.supabaseAdmin
            .from('stigmas')
            .select('user_name')
            .eq('user_id', sites.data.updated_by)
            .maybeSingle();

          if (fallbackStigma.data?.user_name) {
            updatedByName = decrypt(fallbackStigma.data.user_name);
          }
        }
      }
    }

    const rawProfilePicture = access.rhizome.profile_picture ?? '';
    let profilePictureUrl = '';

    if (rawProfilePicture) {
      if (rawProfilePicture.startsWith('supabase:')) {
        const targetPath = rawProfilePicture.replace('supabase:', '').trim();
        const publicUrl = access.supabaseAdmin.storage.from('avatar').getPublicUrl(targetPath);
        profilePictureUrl = publicUrl.data.publicUrl ?? '';
      } else {
        profilePictureUrl = rawProfilePicture;
      }
    }

    return Response.json({
      rhizomes: access.rhizome,
      profilePictureUrl,
      sites: {
        updated_at: sites.data.updated_at,
        updated_by: sites.data.updated_by,
        updated_by_name: updatedByName,
        log: sites.data.log ?? '사이트 개설',
      },
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '사이트 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '사이트 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
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

    if (!access.session.stigmaId) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
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
      if (requestBody.value !== 'default') {
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
        updated_by: access.session.stigmaId,
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
