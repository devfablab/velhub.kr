import { r2Storage } from '@/lib/clients/r2Storage';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { hasMembershipFeature } from '@/lib/memberships/features';
import { getSessionClaims } from '@/lib/session/server';
import { getPublicSiteUrl } from '@/lib/siteUrl';
import { normalizeText } from '@/lib/utils';

type MembershipRow = {
  site_id: string;
  role: string | null;
  created_at: string | null;
  approval_at: string | null;
  is_block: boolean | null;
  kicked_at: string | null;
  banned_at: string | null;
  withdrawn_at: string | null;
};

type SiteRow = {
  id: string;
  owner_id: string | null;
  site_key: string | null;
  site_label: string | null;
  site_type: string | null;
  profile_picture: string | null;
  custom_domain: string | null;
  is_closed: boolean | null;
};

export type JoinedSiteRole = 'owner' | 'manager' | 'member';

export type JoinedSite = {
  id: string;
  siteKey: string;
  siteUrl: string;
  siteLabel: string;
  siteType: string;
  profilePictureUrl: string | null;
  role: JoinedSiteRole;
};

const roleOrder: Record<JoinedSiteRole, number> = { owner: 0, manager: 1, member: 2 };

function getRole(value: string | null): JoinedSiteRole {
  const role = normalizeText(value).toLowerCase();

  if (role === 'owner' || role === 'manager') {
    return role;
  }

  return 'member';
}

function getJoinedTime(membership: MembershipRow) {
  const time = new Date(membership.approval_at ?? membership.created_at ?? 0).getTime();

  return Number.isFinite(time) ? time : 0;
}

export async function GET() {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims?.userId) {
      return Response.json({ sites: [] });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('id')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigmaResult.error || !stigmaResult.data) {
      return Response.json({ sites: [] });
    }

    const membershipsResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('site_id, role, created_at, approval_at, is_block, kicked_at, banned_at, withdrawn_at')
      .eq('user_id', stigmaResult.data.id)
      .eq('is_approval', true);

    if (membershipsResult.error) {
      return Response.json({ error: '가입한 사이트 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const memberships = ((membershipsResult.data ?? []) as MembershipRow[]).filter(
      (membership) =>
        !membership.is_block && !membership.kicked_at && !membership.banned_at && !membership.withdrawn_at,
    );

    if (memberships.length === 0) {
      return Response.json({ sites: [] });
    }

    const sitesResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, owner_id, site_key, site_label, site_type, profile_picture, custom_domain, is_closed')
      .in(
        'id',
        memberships.map((membership) => membership.site_id),
      );

    if (sitesResult.error) {
      return Response.json({ error: '가입한 사이트 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const sites = (sitesResult.data ?? []) as SiteRow[];
    const siteMap = new Map(sites.map((site) => [site.id, site]));
    const ownerIds = [...new Set(sites.map((site) => site.owner_id).filter((id): id is string => Boolean(id)))];
    const ownerDomainFeatures = new Map(
      await Promise.all(
        ownerIds.map(async (ownerId) => [ownerId, await hasMembershipFeature(ownerId, 'owner_domain')] as const),
      ),
    );

    const joinedSites = memberships
      .map((membership) => {
        const site = siteMap.get(membership.site_id);
        const siteKey = normalizeText(site?.site_key);

        if (!site || site.is_closed || !siteKey) {
          return null;
        }

        const profilePicture = normalizeText(site.profile_picture);

        return {
          joinedTime: getJoinedTime(membership),
          site: {
            id: site.id,
            siteKey,
            siteUrl: getPublicSiteUrl({
              siteKey,
              customDomain: site.custom_domain,
              hasOwnerDomainFeature: ownerDomainFeatures.get(site.owner_id ?? '') === true,
            }),
            siteLabel: normalizeText(site.site_label) || siteKey,
            siteType: normalizeText(site.site_type).toLowerCase(),
            profilePictureUrl: profilePicture
              ? (r2Storage.from('avatar').getPublicUrl(profilePicture).data.publicUrl ?? null)
              : null,
            role: getRole(membership.role),
          } satisfies JoinedSite,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => roleOrder[a.site.role] - roleOrder[b.site.role] || b.joinedTime - a.joinedTime)
      .map((item) => item.site);

    return Response.json({ sites: joinedSites });
  } catch (error) {
    console.error('[API home/joined-sites]', error);
    return Response.json({ error: '가입한 사이트 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
