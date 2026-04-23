import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

type InviteRow = {
  id: string;
  site_id: string;
  email: string;
  role: string;
  status: string;
  token: string;
  expires_at: string | null;
  joined_at: string | null;
  cancelled_at: string | null;
  created_at: string;
};

type RhizomeRow = {
  id: string;
  site_key: string;
  site_label: string | null;
  site_type: string;
};

function isExpired(value: string | null) {
  if (!value) {
    return true;
  }

  const time = new Date(value).getTime();

  if (Number.isNaN(time)) {
    return true;
  }

  return time < Date.now();
}

function getInvitePath(siteType: string, siteKey: string, token: string) {
  if (siteType === 'community') {
    return `/${siteKey}/invite-community/${token}`;
  }

  if (siteType === 'blog') {
    return `/${siteKey}/invite-blog/${token}`;
  }

  return '';
}

function getSiteTypeLabel(siteType: string) {
  if (siteType === 'community') {
    return '커뮤니티';
  }

  if (siteType === 'blog') {
    return '블로그';
  }

  return siteType;
}

export async function GET() {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims?.email) {
      return Response.json({
        invites: [],
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const email = sessionClaims.email.trim().toLowerCase();
    const nowIsoString = new Date().toISOString();

    const expireInvite = await supabaseAdmin
      .from('invite')
      .update({
        status: 'expired',
      })
      .eq('email', email)
      .eq('status', 'pending')
      .is('cancelled_at', null)
      .lt('expires_at', nowIsoString);

    if (expireInvite.error) {
      return Response.json({ error: '초대 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const inviteResult = await supabaseAdmin
      .from('invite')
      .select('id, site_id, email, role, status, token, expires_at, joined_at, cancelled_at, created_at')
      .eq('email', email)
      .eq('status', 'pending')
      .is('cancelled_at', null)
      .is('joined_at', null)
      .order('created_at', { ascending: false });

    if (inviteResult.error) {
      return Response.json({ error: '초대 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const inviteRows = (inviteResult.data ?? []).filter((invite) => !isExpired(invite.expires_at)) as InviteRow[];

    if (inviteRows.length === 0) {
      return Response.json({
        invites: [],
      });
    }

    const uniqueSiteIds = [...new Set(inviteRows.map((invite) => invite.site_id))];

    const rhizomeResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_label, site_type')
      .in('id', uniqueSiteIds);

    if (rhizomeResult.error) {
      return Response.json({ error: '초대 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const rhizomeMap = new Map<string, RhizomeRow>(
      (rhizomeResult.data ?? []).map((rhizome) => [
        rhizome.id,
        {
          id: rhizome.id,
          site_key: rhizome.site_key,
          site_label: rhizome.site_label,
          site_type: rhizome.site_type,
        },
      ]),
    );

    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('id')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigmaResult.error) {
      return Response.json({ error: '초대 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const stigmaId = stigmaResult.data?.id ?? null;

    let approvedSiteIdSet = new Set<string>();

    if (stigmaId) {
      const membershipResult = await supabaseAdmin
        .from('rhizome_stigmas')
        .select('site_id, is_approval')
        .eq('user_id', stigmaId)
        .eq('is_approval', true)
        .in('site_id', uniqueSiteIds);

      if (membershipResult.error) {
        return Response.json({ error: '초대 목록을 불러오지 못했습니다.' }, { status: 500 });
      }

      approvedSiteIdSet = new Set((membershipResult.data ?? []).map((item) => item.site_id));
    }

    const latestInviteMap = new Map<
      string,
      {
        id: string;
        siteName: string;
        siteLabel: string;
        siteType: string;
        siteTypeLabel: string;
        token: string;
        expiresAt: string | null;
        href: string;
      }
    >();

    for (const invite of inviteRows) {
      if (approvedSiteIdSet.has(invite.site_id)) {
        continue;
      }

      const rhizome = rhizomeMap.get(invite.site_id);

      if (!rhizome) {
        continue;
      }

      const href = getInvitePath(rhizome.site_type, rhizome.site_key, invite.token);

      if (!href) {
        continue;
      }

      if (latestInviteMap.has(invite.site_id)) {
        continue;
      }

      latestInviteMap.set(invite.site_id, {
        id: invite.id,
        siteName: rhizome.site_key,
        siteLabel: rhizome.site_label?.trim() || rhizome.site_key,
        siteType: rhizome.site_type,
        siteTypeLabel: getSiteTypeLabel(rhizome.site_type),
        token: invite.token,
        expiresAt: invite.expires_at,
        href,
      });
    }

    return Response.json({
      invites: [...latestInviteMap.values()],
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '초대 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '초대 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
