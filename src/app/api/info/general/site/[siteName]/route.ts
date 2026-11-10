import { r2Storage } from '@/lib/clients/r2Storage';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { getCommunityManagerAccess } from '@/lib/service/community/communityManager/utils';
import verifySession from '@/lib/session/verifySession';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

type ChangeLogRow = {
  id: string;
  log: string;
  created_by: string | null;
  created_at: string;
};

async function getUpdatedByNames(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  siteId: string,
  stigmaIds: string[],
) {
  const names = new Map<string, string>();

  if (stigmaIds.length === 0) {
    return names;
  }

  const [memberships, stigmaUsers] = await Promise.all([
    supabaseAdmin.from('rhizome_stigmas').select('user_id, nickname').eq('site_id', siteId).in('user_id', stigmaIds),
    supabaseAdmin.from('stigmas').select('id, user_name').in('id', stigmaIds),
  ]);

  for (const stigmaUser of stigmaUsers.data ?? []) {
    if (!stigmaUser.user_name) continue;

    try {
      names.set(stigmaUser.id, decrypt(stigmaUser.user_name));
    } catch {
      names.set(stigmaUser.id, '');
    }
  }

  for (const membership of memberships.data ?? []) {
    if (membership.nickname) {
      names.set(membership.user_id, membership.nickname);
    }
  }

  return names;
}

async function checkAccess(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const rhizome = await supabaseAdmin
    .from('rhizomes')
    .select(
      'id, created_at, owner_id, site_key, site_label, profile_picture, profile_logo, profile_logo_width, profile_logo_height, summary, og_image, promotion_image, site_type, visibility_type, theme_type, is_shutdown, custom_domain',
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

      return {
        ok: true,
        status: 200,
        rhizome: rhizome.data,
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

  if (rhizome.data.site_type === 'blog' && rhizome.data.visibility_type === 'public' && !rhizome.data.is_shutdown) {
    return {
      ok: true,
      status: 200,
      rhizome: rhizome.data,
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
      error: '접근 권한이 없습니다.',
    } as const;
  }

  return {
    ok: true,
    status: 200,
    rhizome: rhizome.data,
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

    const [changeLogs, blogs, features] = await Promise.all([
      access.supabaseAdmin
        .from('site_change_logs')
        .select('id, log, created_by, created_at')
        .eq('site_id', access.rhizome.id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(20),
      access.rhizome.site_type === 'blog'
        ? access.supabaseAdmin.from('blogs').select('blog_type').eq('site_id', access.rhizome.id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      import('@/lib/memberships/features').then((m) => m.getMembershipFeatures(access.rhizome.owner_id as string)),
    ]);

    if (changeLogs.error) {
      return Response.json({ error: '수정내역을 불러오지 못했습니다.' }, { status: 500 });
    }

    const changeLogRows = (changeLogs.data ?? []) as ChangeLogRow[];
    const updatedByNames = await getUpdatedByNames(access.supabaseAdmin, access.rhizome.id, [
      ...new Set(changeLogRows.map((row) => row.created_by).filter((id): id is string => Boolean(id))),
    ]);
    const logs =
      changeLogRows.length > 0
        ? changeLogRows.map((row) => ({
            id: row.id,
            log: row.log,
            created_at: row.created_at,
            created_by_name: row.created_by ? (updatedByNames.get(row.created_by) ?? '') : '',
          }))
        : [{ id: 'site-created', log: '사이트 개설', created_at: access.rhizome.created_at, created_by_name: '' }];

    const rawProfilePicture = normalizeText(access.rhizome.profile_picture);
    let profilePictureUrl = '';

    if (rawProfilePicture) {
      const publicUrl = r2Storage.from('avatar').getPublicUrl(rawProfilePicture);
      profilePictureUrl = publicUrl.data.publicUrl ?? '';
    }

    const rawProfileLogo = normalizeText(access.rhizome.profile_logo);
    let profileLogoUrl = '';

    if (rawProfileLogo) {
      const publicUrl = r2Storage.from('site-logo').getPublicUrl(rawProfileLogo);
      profileLogoUrl = publicUrl.data.publicUrl ?? '';
    }

    const rawSiteOgImage = normalizeText(access.rhizome.og_image);
    let siteOgImageUrl = '';

    if (rawSiteOgImage) {
      const publicUrl = r2Storage.from('site-og').getPublicUrl(rawSiteOgImage);
      siteOgImageUrl = publicUrl.data.publicUrl ?? '';
    }

    const rawPromotionImage = normalizeText(access.rhizome.promotion_image);
    let promotionImageUrl = '';

    if (rawPromotionImage) {
      const publicUrl = r2Storage.from('promotion-image').getPublicUrl(rawPromotionImage);
      promotionImageUrl = publicUrl.data.publicUrl ?? '';
    }

    return Response.json({
      siteInfo: access.rhizome,
      profilePictureUrl,
      profileLogoUrl,
      siteOgImageUrl,
      promotionImageUrl,
      blogType: blogs.data?.blog_type ?? null,
      hasOwnerDomainFeature: features.has('owner_domain'),
      logs,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '사이트 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '사이트 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
