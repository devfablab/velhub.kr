import { decrypt } from '@/lib/encryption/decrypt';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SiteType = 'blog' | 'community';

type SiteRow = {
  id: string;
  site_key: string;
  site_type: string;
  theme_type: string;
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

const CHECKIN_INTERVAL_MS = 30 * 60 * 1000;

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
      .select('id, site_key, site_type, theme_type')
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

    return Response.json({
      siteName: site.site_key,
      siteType: isSiteType(site.site_type) ? site.site_type : null,
      isLoggedIn: true,
      email: decryptValue(account.email),
      userName: decryptValue(account.user_name),
      avatar: account.avatar ?? null,
      themeType: siteResult.data.theme_type,
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
