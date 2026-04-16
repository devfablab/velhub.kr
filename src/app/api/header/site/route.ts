import { decrypt } from '@/lib/encryption/decrypt';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type ThemeMode = 'light' | 'system' | 'dark';
type SiteType = 'blog' | 'community';

type SiteRow = {
  id: string;
  site_key: string;
  site_type: string | null;
};

type AccountRow = {
  email: string | null;
  user_name: string | null;
  avatar: string | null;
  role: string | null;
};

type ProfileRow = {
  theme_mode: string | null;
};

type MembershipRow = {
  role: string | null;
};

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

function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return value === 'light' || value === 'system' || value === 'dark';
}

function isSiteType(value: string | null | undefined): value is SiteType {
  return value === 'blog' || value === 'community';
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
      .select('id, site_key, site_type')
      .eq('site_key', siteName)
      .maybeSingle();

    if (siteResult.error || !siteResult.data) {
      return Response.json({ error: '사이트 정보를 불러오지 못했습니다.' }, { status: 404 });
    }

    const site = siteResult.data as SiteRow;
    const session = await verifySession({ siteId: site.id });

    if (!session.authUserId) {
      return Response.json({
        siteName: site.site_key,
        siteType: isSiteType(site.site_type) ? site.site_type : null,
        isLoggedIn: false,
        email: null,
        userName: null,
        avatar: null,
        themeMode: null,
        globalRole: null,
        siteRole: null,
        sessionCase: session.case ?? null,
      });
    }

    const accountResult = await supabaseAdmin
      .from('stigmas')
      .select('email, user_name, avatar, role')
      .eq('user_id', session.authUserId)
      .maybeSingle();

    if (accountResult.error || !accountResult.data) {
      return Response.json({ error: '헤더 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const profileResult = await supabaseAdmin
      .from('profiles')
      .select('theme_mode')
      .eq('user_id', session.authUserId)
      .maybeSingle();

    if (profileResult.error) {
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
    const profile = (profileResult.data ?? null) as ProfileRow | null;

    return Response.json({
      siteName: site.site_key,
      siteType: isSiteType(site.site_type) ? site.site_type : null,
      isLoggedIn: true,
      email: decryptValue(account.email),
      userName: decryptValue(account.user_name),
      avatar: account.avatar ?? null,
      themeMode: isThemeMode(profile?.theme_mode ?? null) ? profile?.theme_mode : null,
      globalRole: normalizeText(account.role).toLowerCase() || null,
      siteRole: normalizeText(membership?.role).toLowerCase() || null,
      sessionCase: session.case ?? null,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '헤더 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '헤더 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
