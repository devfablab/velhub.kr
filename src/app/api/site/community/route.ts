import { decrypt } from '@/lib/encryption/decrypt';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SiteInfoRow = {
  id: string;
  created_at: string;
  site_key: string;
  site_label: string | null;
  profile_picture: string | null;
  summary: string | null;
  site_type: string | null;
};

type CommunityRow = {
  id: string;
  site_id: string;
  join_accept_status: string | null;
  join_type: string | null;
};

type MemberRow = {
  id: string;
  user_id: string;
  role: string | null;
  nickname: string | null;
};

type StigmaRow = {
  id: string;
  user_name: string | null;
};

type ManagerRow = {
  manager_id: string;
  role: string | null;
};

function decryptNullable(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '';
  }

  try {
    return decrypt(normalizedValue);
  } catch {
    return '';
  }
}

function getDisplayName(member: MemberRow | null | undefined, stigmaMap: Map<string, StigmaRow>) {
  const nickname = normalizeText(member?.nickname);

  if (nickname) {
    return nickname;
  }

  const stigma = member?.user_id ? stigmaMap.get(member.user_id) : null;

  return decryptNullable(stigma?.user_name);
}

function getProfilePictureUrl(profilePicture: string | null | undefined) {
  const normalizedProfilePicture = normalizeText(profilePicture);

  if (!normalizedProfilePicture) {
    return '';
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from('avatar').getPublicUrl(normalizedProfilePicture);

  return publicUrl.data.publicUrl ?? '';
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const siteResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, created_at, site_key, site_label, profile_picture, summary, site_type')
      .eq('site_key', siteName)
      .maybeSingle();

    if (siteResult.error || !siteResult.data) {
      return Response.json({ error: '사이트 정보를 불러오지 못했습니다.' }, { status: 404 });
    }

    const site = siteResult.data as SiteInfoRow;

    if (site.site_type !== 'community') {
      return Response.json({ error: '커뮤니티 정보를 불러올 수 없습니다.' }, { status: 400 });
    }

    const communityResult = await supabaseAdmin
      .from('communities')
      .select('id, site_id, join_accept_status, join_type')
      .eq('site_id', site.id)
      .maybeSingle();

    if (communityResult.error || !communityResult.data) {
      return Response.json({ error: '커뮤니티 정보를 불러오지 못했습니다.' }, { status: 404 });
    }

    const community = communityResult.data as CommunityRow;

    const approvedMembersResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('id, user_id, role, nickname')
      .eq('site_id', site.id)
      .eq('is_approval', true);

    if (approvedMembersResult.error) {
      return Response.json({ error: '커뮤니티 멤버 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const approvedMembers = (approvedMembersResult.data ?? []) as MemberRow[];
    const owner = approvedMembers.find((member) => normalizeText(member.role) === 'owner') ?? null;

    const managerRowsResult = await supabaseAdmin
      .from('community_manage_role')
      .select('manager_id, role')
      .eq('community_id', community.id)
      .eq('role', 'community-manager');

    if (managerRowsResult.error) {
      return Response.json({ error: '커뮤니티 매니저 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const managerRows = (managerRowsResult.data ?? []) as ManagerRow[];
    const managerIds = [...new Set(managerRows.map((manager) => normalizeText(manager.manager_id)).filter(Boolean))];
    const managerMembers = approvedMembers.filter((member) => managerIds.includes(member.id));
    const userIds = [
      ...new Set([owner, ...managerMembers].map((member) => normalizeText(member?.user_id)).filter(Boolean)),
    ];

    const stigmaResult =
      userIds.length > 0
        ? await supabaseAdmin.from('stigmas').select('id, user_name').in('id', userIds)
        : { data: [], error: null };

    if (stigmaResult.error) {
      return Response.json({ error: '커뮤니티 사용자 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const stigmaMap = new Map(((stigmaResult.data ?? []) as StigmaRow[]).map((stigma) => [stigma.id, stigma]));

    return Response.json({
      ok: true,
      siteInfo: {
        siteType: site.site_type,
        siteLabel: normalizeText(site.site_label) || site.site_key,
        createdAt: site.created_at,
        summary: site.summary,
        profilePictureUrl: getProfilePictureUrl(site.profile_picture),
        ownerNickname: getDisplayName(owner, stigmaMap),
        memberCount: approvedMembers.length,
        joinAcceptStatus: normalizeText(community.join_accept_status) || 'enabled',
        joinType: normalizeText(community.join_type) || 'open',
        managerNicknames: managerMembers.map((member) => getDisplayName(member, stigmaMap)).filter(Boolean),
      },
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '커뮤니티 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '커뮤니티 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
