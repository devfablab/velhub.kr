import { decrypt } from '@/lib/encryption/decrypt';
import { getSessionClaims } from '@/lib/session';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SiteType = 'blog' | 'community';

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
  site_type: string;
  theme_type: string;
  profile_picture: string | null;
  profile_logo: string | null;
};

type SiteVisitCountRow = {
  id: string;
  visit_count: number | string | null;
};

type SiteVisitRow = {
  id: string;
  last_visited_at: string | null;
};

type AccountRow = {
  email: string;
  user_name: string;
  avatar: string | null;
  role: string | null;
};

type MembershipRow = {
  role: string | null;
  nickname: string | null;
  is_approval: boolean | null;
};

type CommunityManageRoleRow = {
  role: string | null;
};

type CheckinRow = {
  last_checkin_at: string | null;
  checkin_count: number | null;
};

type BlogFontRow = {
  subject_font_family: string | null;
  subject_letter_spacing: number | null;
  subject_line_height: number | null;
  description_font_family: string | null;
  description_letter_spacing: number | null;
  description_line_height: number | null;
  description_font_size: number | null;
  description_margin: number | null;
};

const CHECKIN_INTERVAL_MS = 30 * 60 * 1000;
const VISIT_INTERVAL_MS = 24 * 60 * 60 * 1000;

function getPublicUrl(bucket: string, path: string | null | undefined) {
  const normalizedPath = normalizeText(path);

  if (!normalizedPath) {
    return null;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from(bucket).getPublicUrl(normalizedPath);

  return publicUrl.data.publicUrl ?? null;
}

function processAvatar(avatar: string | null) {
  if (!avatar) {
    return null;
  }

  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return avatar;
  }

  return getPublicUrl('avatar', avatar);
}

function decryptValue(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return null;
  }

  try {
    const decryptedValue = decrypt(normalizedValue);

    if (decryptedValue.startsWith('naver_')) {
      return null;
    }

    return decryptedValue;
  } catch {
    return null;
  }
}

function isSiteType(value: string | null | undefined): value is SiteType {
  return value === 'blog' || value === 'community';
}

function getForwardedIp(value: string | null) {
  if (!value) {
    return null;
  }

  return normalizeText(value.split(',')[0]);
}

function getRequestIp(request: Request) {
  const forwardedForIp = getForwardedIp(request.headers.get('x-forwarded-for'));

  if (forwardedForIp) {
    return forwardedForIp;
  }

  const realIp = normalizeText(request.headers.get('x-real-ip'));

  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = normalizeText(request.headers.get('cf-connecting-ip'));

  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  if (process.env.NODE_ENV === 'development') {
    return 'local';
  }

  return null;
}

function shouldIncreaseCheckin(lastCheckinAt: string | null | undefined) {
  if (!lastCheckinAt) {
    return true;
  }

  const lastCheckinTime = new Date(lastCheckinAt).getTime();

  if (Number.isNaN(lastCheckinTime)) {
    return true;
  }

  return Date.now() - lastCheckinTime >= CHECKIN_INTERVAL_MS;
}

function shouldIncreaseVisit(lastVisitedAt: string | null | undefined) {
  if (!lastVisitedAt) {
    return true;
  }

  const lastVisitedTime = new Date(lastVisitedAt).getTime();

  if (Number.isNaN(lastVisitedTime)) {
    return true;
  }

  return Date.now() - lastVisitedTime >= VISIT_INTERVAL_MS;
}

async function getBlogFontSettings(siteId: string, siteType: SiteType | null) {
  if (siteType !== 'blog') {
    return null;
  }

  const supabaseAdmin = getSupabaseAdmin();

  const blogResult = await supabaseAdmin
    .from('blogs')
    .select(
      'subject_font_family, subject_letter_spacing, subject_line_height, description_font_family, description_letter_spacing, description_line_height, description_font_size, description_margin',
    )
    .eq('site_id', siteId)
    .maybeSingle();

  if (blogResult.error || !blogResult.data) {
    return null;
  }

  const blog = blogResult.data as BlogFontRow;

  return {
    subjectFontFamily: blog.subject_font_family,
    subjectLetterSpacing: blog.subject_letter_spacing,
    subjectLineHeight: blog.subject_line_height,
    descriptionFontFamily: blog.description_font_family,
    descriptionLetterSpacing: blog.description_letter_spacing,
    descriptionLineHeight: blog.description_line_height,
    descriptionFontSize: blog.description_font_size,
    descriptionMargin: blog.description_margin,
  };
}

async function processVisit(siteId: string, request: Request) {
  const ipAddress = getRequestIp(request);

  if (!ipAddress) {
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();

  const siteVisitCountResult = await supabaseAdmin
    .from('sites')
    .select('id, visit_count')
    .eq('site_id', siteId)
    .maybeSingle();

  if (siteVisitCountResult.error || !siteVisitCountResult.data) {
    return;
  }

  const siteVisitCount = siteVisitCountResult.data as SiteVisitCountRow;

  const nowIsoString = new Date().toISOString();

  const visitResult = await supabaseAdmin
    .from('site_visits')
    .select('id, last_visited_at')
    .eq('site_id', siteVisitCount.id)
    .eq('ip_address', ipAddress)
    .order('last_visited_at', { ascending: false })
    .limit(1);

  if (visitResult.error) {
    return;
  }

  const visit = (visitResult.data?.[0] ?? null) as SiteVisitRow | null;

  if (!visit) {
    const insertVisitResult = await supabaseAdmin.from('site_visits').insert({
      site_id: siteVisitCount.id,
      ip_address: ipAddress,
      last_visited_at: nowIsoString,
    });

    if (insertVisitResult.error) {
      return;
    }

    await supabaseAdmin
      .from('sites')
      .update({
        visit_count: (Number(siteVisitCount.visit_count ?? 0) || 0) + 1,
      })
      .eq('id', siteVisitCount.id);

    return;
  }

  const shouldCount = shouldIncreaseVisit(visit.last_visited_at);

  const updateVisitResult = await supabaseAdmin
    .from('site_visits')
    .update({
      last_visited_at: nowIsoString,
    })
    .eq('id', visit.id);

  if (updateVisitResult.error || !shouldCount) {
    return;
  }

  await supabaseAdmin
    .from('sites')
    .update({
      visit_count: (Number(siteVisitCount.visit_count ?? 0) || 0) + 1,
    })
    .eq('id', siteVisitCount.id);
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
      .select('id, site_key, site_label, site_type, theme_type, profile_picture, profile_logo')
      .eq('site_key', siteName)
      .maybeSingle();

    if (siteResult.error || !siteResult.data) {
      return Response.json({ error: '사이트 정보를 불러오지 못했습니다.' }, { status: 404 });
    }

    const site = siteResult.data as SiteRow;
    const siteType = isSiteType(site.site_type) ? site.site_type : null;

    const blogFontSettings = await getBlogFontSettings(site.id, siteType);

    await processVisit(site.id, request);

    const session = await verifySession({
      siteId: site.id,
    });

    if (!session.authUserId) {
      return Response.json({
        siteName: site.site_key,
        siteType,
        themeType: site.theme_type,
        blogFontSettings,
        isLoggedIn: false,
        email: null,
        userName: null,
        avatar: null,
        globalRole: null,
        siteRole: null,
        siteRoles: [],
        nickname: null,
        isApproval: null,
        invite: false,
        join: false,
        sessionCase: session.case ?? null,
        siteLabel: site.site_label,
        profilePictureUrl: getPublicUrl('avatar', site.profile_picture),
        profileLogoUrl: getPublicUrl('site-logo', site.profile_logo),
      });
    }

    if ((session.case === 'staff' || session.case === 'member') && session.rhizomeStigmaId) {
      const checkinResult = await supabaseAdmin
        .from('rhizome_stigmas')
        .select('last_checkin_at, checkin_count')
        .eq('id', session.rhizomeStigmaId)
        .maybeSingle();

      if (checkinResult.error || !checkinResult.data) {
        return Response.json({ error: '헤더 정보를 불러오지 못했습니다.' }, { status: 500 });
      }

      const checkin = checkinResult.data as CheckinRow;
      const nowIsoString = new Date().toISOString();

      const nextCheckinCount = shouldIncreaseCheckin(checkin.last_checkin_at)
        ? (Number(checkin.checkin_count ?? 0) || 0) + 1
        : Number(checkin.checkin_count ?? 0) || 0;

      const updateCheckinResult = await supabaseAdmin
        .from('rhizome_stigmas')
        .update({
          last_checkin_at: nowIsoString,
          checkin_count: nextCheckinCount,
        })
        .eq('id', session.rhizomeStigmaId);

      if (updateCheckinResult.error) {
        return Response.json({ error: '헤더 정보를 불러오지 못했습니다.' }, { status: 500 });
      }
    }

    const accountResult = await supabaseAdmin
      .from('stigmas')
      .select('email, user_name, avatar, role')
      .eq('user_id', session.authUserId)
      .maybeSingle();

    if (accountResult.error || !accountResult.data) {
      return Response.json({ error: '헤더 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    let membership: MembershipRow | null = null;

    if (session.rhizomeStigmaId) {
      const membershipResult = await supabaseAdmin
        .from('rhizome_stigmas')
        .select('role, nickname, is_approval')
        .eq('id', session.rhizomeStigmaId)
        .maybeSingle();

      if (membershipResult.error) {
        return Response.json({ error: '헤더 정보를 불러오지 못했습니다.' }, { status: 500 });
      }

      membership = (membershipResult.data ?? null) as MembershipRow | null;
    }

    let siteRoles: string[] = [];

    if (membership?.is_approval === true) {
      const membershipRole = normalizeText(membership.role).toLowerCase();

      if (siteType === 'blog') {
        siteRoles = membershipRole ? [membershipRole] : [];
      }

      if (siteType === 'community') {
        if (membershipRole === 'owner') {
          siteRoles = ['owner'];
        } else if (session.rhizomeStigmaId) {
          const communityResult = await supabaseAdmin
            .from('communities')
            .select('id')
            .eq('site_id', site.id)
            .maybeSingle();

          if (communityResult.error || !communityResult.data) {
            return Response.json(
              {
                error: '헤더 정보를 불러오지 못했습니다.',
              },
              { status: 500 },
            );
          }

          const communityManageRoleResult = await supabaseAdmin
            .from('community_manage_role')
            .select('role')
            .eq('community_id', communityResult.data.id)
            .eq('manager_id', session.rhizomeStigmaId);

          if (communityManageRoleResult.error) {
            return Response.json(
              {
                error: '헤더 정보를 불러오지 못했습니다.',
              },
              { status: 500 },
            );
          }

          const communityManageRoles = ((communityManageRoleResult.data ?? []) as CommunityManageRoleRow[])
            .map((item) => normalizeText(item.role).toLowerCase())
            .filter(Boolean);

          siteRoles =
            communityManageRoles.length > 0
              ? [...new Set(communityManageRoles)]
              : membershipRole === 'member'
                ? ['member']
                : [];
        }
      }
    }

    const sessionClaims = await getSessionClaims();
    const inviteEmail = normalizeText(sessionClaims?.email).toLowerCase();

    let hasInvite = false;

    if (!membership && inviteEmail) {
      const nowIsoString = new Date().toISOString();

      const inviteResult = await supabaseAdmin
        .from('invite')
        .select('id')
        .eq('site_id', site.id)
        .eq('email', inviteEmail)
        .eq('role', 'member')
        .eq('status', 'pending')
        .is('cancelled_at', null)
        .is('joined_at', null)
        .gt('expires_at', nowIsoString)
        .limit(1);

      if (inviteResult.error) {
        return Response.json({ error: '헤더 정보를 불러오지 못했습니다.' }, { status: 500 });
      }

      hasInvite = (inviteResult.data?.length ?? 0) > 0;
    }

    const account = accountResult.data as AccountRow;
    const isApproval = membership?.is_approval === true ? true : membership?.is_approval === false ? false : null;

    return Response.json({
      siteName: site.site_key,
      siteType,
      themeType: site.theme_type,
      blogFontSettings,
      isLoggedIn: true,
      email: decryptValue(account.email),
      userName: decryptValue(account.user_name),
      avatar: processAvatar(account.avatar),
      globalRole: normalizeText(account.role).toLowerCase() || null,
      siteRole: normalizeText(membership?.role).toLowerCase() || null,
      siteRoles,
      nickname: membership?.is_approval === true ? normalizeText(membership.nickname) || null : null,
      isApproval,
      invite: hasInvite,
      join: Boolean(membership) || hasInvite,
      sessionCase: session.case ?? null,
      siteLabel: site.site_label,
      profilePictureUrl: getPublicUrl('avatar', site.profile_picture),
      profileLogoUrl: getPublicUrl('site-logo', site.profile_logo),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '헤더 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '헤더 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
