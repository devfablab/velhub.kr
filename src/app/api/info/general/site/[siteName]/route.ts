import { getCommunityManagerAccess } from '@/lib/community-manager/utils';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

async function getUpdatedByName(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  siteId: string,
  particleId: string,
) {
  const nickname = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('nickname')
    .eq('site_id', siteId)
    .eq('user_id', particleId)
    .maybeSingle();

  if (nickname.data?.nickname) {
    return nickname.data.nickname;
  }

  const stigmaUser = await supabaseAdmin.from('stigmas').select('user_name').eq('user_id', particleId).maybeSingle();

  if (stigmaUser.data?.user_name) {
    return decrypt(stigmaUser.data.user_name);
  }

  return '';
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
          error: '접근 권한이 없습니다1.',
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
          error: unknownError.message || '접근 권한이 없습니다2.',
        } as const;
      }

      return {
        ok: false,
        status: 403,
        error: '접근 권한이 없습니다3.',
      } as const;
    }
  }

  if (rhizome.data.site_type === 'blog' && rhizome.data.visibility_type === 'public' && !rhizome.data.is_shutdown) {
    return {
      ok: true,
      status: 200,
      rhizome: rhizome.data,
      updatedByParticleId: '',
      supabaseAdmin,
    } as const;
  }

  const session = await verifySession({
    siteId: rhizome.data.id,
  });

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
      error: '접근 권한이 없습니다5.',
    } as const;
  }

  return {
    ok: true,
    status: 200,
    rhizome: rhizome.data,
    updatedByParticleId: membership.data.user_id as string,
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

    const updatedByName = sites.data.updated_by
      ? await getUpdatedByName(access.supabaseAdmin, access.rhizome.id, sites.data.updated_by)
      : '';

    const rawProfilePicture = normalizeText(access.rhizome.profile_picture);
    let profilePictureUrl = '';

    if (rawProfilePicture) {
      const publicUrl = access.supabaseAdmin.storage.from('avatar').getPublicUrl(rawProfilePicture);
      profilePictureUrl = publicUrl.data.publicUrl ?? '';
    }

    const rawProfileLogo = normalizeText(access.rhizome.profile_logo);
    let profileLogoUrl = '';

    if (rawProfileLogo) {
      const publicUrl = access.supabaseAdmin.storage.from('site-logo').getPublicUrl(rawProfileLogo);
      profileLogoUrl = publicUrl.data.publicUrl ?? '';
    }

    return Response.json({
      siteInfo: access.rhizome,
      profilePictureUrl,
      profileLogoUrl,
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
