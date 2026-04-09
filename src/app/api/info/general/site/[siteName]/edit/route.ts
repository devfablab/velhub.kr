import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption/decrypt';

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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { siteName } = await context.params;
    const normalizedSiteName = siteName.trim().toLowerCase();

    if (!normalizedSiteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('id')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigmaResult.error || !stigmaResult.data) {
      return Response.json({ error: '사용자 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const rhizomeResult = await supabaseAdmin
      .from('rhizomes')
      .select(
        'id, created_at, site_key, site_label, profile_picture, summary, site_type, visibility_type, theme_type, is_shutdown',
      )
      .eq('site_key', normalizedSiteName)
      .maybeSingle();

    if (rhizomeResult.error || !rhizomeResult.data) {
      return Response.json({ error: '사이트 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const permissionResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('role')
      .eq('site_id', rhizomeResult.data.id)
      .eq('user_id', stigmaResult.data.id)
      .in('role', ['owner', 'manager'])
      .maybeSingle();

    if (permissionResult.error || !permissionResult.data) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const siteResult = await supabaseAdmin
      .from('sites')
      .select('updated_at, updated_by, log')
      .eq('site_id', rhizomeResult.data.id)
      .maybeSingle();

    if (siteResult.error || !siteResult.data) {
      return Response.json({ error: 'sites 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    let updatedByName = '';

    if (siteResult.data.updated_by) {
      const nicknameResult = await supabaseAdmin
        .from('rhizome_stigmas')
        .select('nickname')
        .eq('site_id', rhizomeResult.data.id)
        .eq('user_id', siteResult.data.updated_by)
        .maybeSingle();

      if (nicknameResult.data?.nickname) {
        updatedByName = nicknameResult.data.nickname;
      } else {
        const stigmaUserResult = await supabaseAdmin
          .from('stigmas')
          .select('user_name')
          .eq('id', siteResult.data.updated_by)
          .maybeSingle();

        if (stigmaUserResult.data?.user_name) {
          updatedByName = decrypt(stigmaUserResult.data.user_name);
        } else {
          const particleResult = await supabaseAdmin
            .from('particles')
            .select('id')
            .eq('id', siteResult.data.updated_by)
            .maybeSingle();

          if (particleResult.data) {
            const fallbackStigmaResult = await supabaseAdmin
              .from('stigmas')
              .select('id, user_name')
              .eq('user_id', particleResult.data.id)
              .maybeSingle();

            if (fallbackStigmaResult.data?.id) {
              const fallbackNicknameResult = await supabaseAdmin
                .from('rhizome_stigmas')
                .select('nickname')
                .eq('site_id', rhizomeResult.data.id)
                .eq('user_id', fallbackStigmaResult.data.id)
                .maybeSingle();

              if (fallbackNicknameResult.data?.nickname) {
                updatedByName = fallbackNicknameResult.data.nickname;
              } else if (fallbackStigmaResult.data.user_name) {
                updatedByName = decrypt(fallbackStigmaResult.data.user_name);
              }
            }
          }
        }
      }
    }

    const rawProfilePicture = rhizomeResult.data.profile_picture ?? '';
    let profilePictureUrl = '';

    if (rawProfilePicture) {
      if (rawProfilePicture.startsWith('supabase:')) {
        const targetPath = rawProfilePicture.replace('supabase:', '').trim();
        const publicUrlResult = supabaseAdmin.storage.from('avatar').getPublicUrl(targetPath);
        profilePictureUrl = publicUrlResult.data.publicUrl ?? '';
      } else {
        profilePictureUrl = rawProfilePicture;
      }
    }

    return Response.json({
      rhizomes: rhizomeResult.data,
      profilePictureUrl,
      sites: {
        updated_at: siteResult.data.updated_at,
        updated_by: siteResult.data.updated_by,
        updated_by_name: updatedByName,
        log: siteResult.data.log ?? '사이트 생성',
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
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { siteName } = await context.params;
    const normalizedSiteName = siteName.trim().toLowerCase();

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

    const supabaseAdmin = getSupabaseAdmin();

    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('id')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigmaResult.error || !stigmaResult.data) {
      return Response.json({ error: '사용자 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const currentRhizomeResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_label, profile_picture, summary, visibility_type, theme_type, is_shutdown')
      .eq('site_key', normalizedSiteName)
      .maybeSingle();

    if (currentRhizomeResult.error || !currentRhizomeResult.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const permissionResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('role')
      .eq('site_id', currentRhizomeResult.data.id)
      .eq('user_id', stigmaResult.data.id)
      .in('role', ['owner', 'manager'])
      .maybeSingle();

    if (permissionResult.error || !permissionResult.data) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    let previousValue: string | boolean | null = currentRhizomeResult.data[requestBody.field];
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

      const denylistResult = await supabaseAdmin
        .from('denylist')
        .select('word')
        .eq('word', normalizedValue)
        .maybeSingle();

      if (denylistResult.error) {
        return Response.json({ error: '사이트 식별자 확인에 실패했습니다.' }, { status: 500 });
      }

      if (denylistResult.data) {
        return Response.json({ error: '사용할 수 없는 사이트 식별자입니다.' }, { status: 400 });
      }

      const duplicateResult = await supabaseAdmin
        .from('rhizomes')
        .select('id')
        .eq('site_key', normalizedValue)
        .neq('id', currentRhizomeResult.data.id)
        .maybeSingle();

      if (duplicateResult.error) {
        return Response.json({ error: '사이트 식별자 확인에 실패했습니다.' }, { status: 500 });
      }

      if (duplicateResult.data) {
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

    const rhizomeUpdateResult = await supabaseAdmin
      .from('rhizomes')
      .update({
        [requestBody.field]: nextValue,
      })
      .eq('id', currentRhizomeResult.data.id);

    if (rhizomeUpdateResult.error) {
      return Response.json({ error: '사이트 정보 수정에 실패했습니다.' }, { status: 500 });
    }

    const nowIsoString = new Date().toISOString();
    const logMessage = formatLogMessage(requestBody.field, previousValue, nextValue);

    const sitesUpdateResult = await supabaseAdmin
      .from('sites')
      .update({
        updated_at: nowIsoString,
        updated_by: stigmaResult.data.id,
        log: logMessage,
      })
      .eq('site_id', currentRhizomeResult.data.id);

    if (sitesUpdateResult.error) {
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
