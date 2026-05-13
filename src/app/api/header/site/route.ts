import { decrypt } from '@/lib/encryption/decrypt';
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

type AccountRow = {
  email: string;
  user_name: string;
  avatar: string | null;
  role: string | null;
};

type MembershipRow = {
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

function getPublicUrl(bucket: string, path: string | null | undefined) {
  const normalizedPath = normalizeText(path);

  if (!normalizedPath) {
    return null;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from(bucket).getPublicUrl(normalizedPath);

  return publicUrl.data.publicUrl ?? null;
}

function decryptValue(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return null;
  }

  try {
    return decrypt(normalizedValue);
  } catch {
    return null;
  }
}

function isSiteType(value: string | null | undefined): value is SiteType {
  return value === 'blog' || value === 'community';
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

    const session = await verifySession({ siteId: site.id });

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

    if ((session.case === 'staff' || session.case === 'member') && session.rhizomeStigmaId) {
      const membershipResult = await supabaseAdmin
        .from('rhizome_stigmas')
        .select('role')
        .eq('id', session.rhizomeStigmaId)
        .maybeSingle();

      if (membershipResult.error) {
        return Response.json({ error: '헤더 정보를 불러오지 못했습니다.' }, { status: 500 });
      }

      membership = (membershipResult.data ?? null) as MembershipRow | null;
    }

    const account = accountResult.data as AccountRow;

    return Response.json({
      siteName: site.site_key,
      siteType,
      themeType: site.theme_type,
      blogFontSettings,
      isLoggedIn: true,
      email: decryptValue(account.email),
      userName: decryptValue(account.user_name),
      avatar: account.avatar ?? null,
      globalRole: normalizeText(account.role).toLowerCase() || null,
      siteRole: normalizeText(membership?.role).toLowerCase() || null,
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
