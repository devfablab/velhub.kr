import { decrypt } from '@/lib/encryption/decrypt';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RpcLatestPost = {
  id: string;
  slug: number | string;
  subject: string | null;
  board_key: string;
  author_nickname: string | null;
  author_user_name: string | null;
  comment_count: number;
  published_at: string;
};

type RpcJoinSite = {
  id: string;
  site_key: string;
  site_label: string;
  site_type: string;
  profile_picture: string | null;
  profile_logo: string | null;
  role: string | null;
  latest_posts: RpcLatestPost[];
};

type RpcResult = {
  user_found: boolean;
  role: string | null;
  join_sites: RpcJoinSite[];
};

type MembershipStatus = 'block' | 'kick' | 'ban' | 'rejoin';
type SiteOperationalStatus = 'normal' | 'payment_failed' | 'shutdown' | 'blocked' | 'closed';

type MembershipRow = {
  site_id: string;
  role: string | null;
  is_block: boolean | null;
  is_rejoin: boolean | null;
  blocked_at: string | null;
  block_term: string | null;
  kicked_at: string | null;
  kick_term: string | null;
  banned_at: string | null;
  ban_term: string | null;
  cleared_at: string | null;
  withdrawn_at: string | null;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
  site_type: string | null;
  profile_picture: string | null;
  profile_logo: string | null;
  is_shutdown: boolean | null;
  is_blocked: boolean | null;
  is_closed: boolean | null;
};

type SubscriptionRow = {
  target_id: string;
  status: string | null;
  created_at: string;
};

function getMembershipStatus(membership: MembershipRow): MembershipStatus | null {
  if (membership.is_block) {
    return 'block';
  }

  if (membership.kicked_at) {
    return 'kick';
  }

  if (membership.banned_at) {
    return 'ban';
  }

  if (membership.is_rejoin && !membership.withdrawn_at) {
    return 'rejoin';
  }

  return null;
}

function getOperationalStatus(site: SiteRow, subscriptionStatus: string | null): SiteOperationalStatus {
  if (site.is_closed) {
    return 'closed';
  }

  if (site.is_blocked) {
    return 'blocked';
  }

  if (subscriptionStatus === 'past_due') {
    return 'payment_failed';
  }

  if (site.is_shutdown) {
    return 'shutdown';
  }

  return 'normal';
}

function getOperationalStatusLabel(status: SiteOperationalStatus) {
  if (status === 'payment_failed') {
    return '요금제 결제 실패';
  }

  if (status === 'shutdown') {
    return '운영 중지';
  }

  if (status === 'blocked') {
    return '운영 정지';
  }

  if (status === 'closed') {
    return '폐쇄';
  }

  return '정상 운행';
}

function getPublicUrl(bucket: string, path: string | null | undefined) {
  const normalizedPath = normalizeText(path);

  if (!normalizedPath) {
    return null;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrlResult = supabaseAdmin.storage.from(bucket).getPublicUrl(normalizedPath);

  return publicUrlResult.data.publicUrl ?? null;
}

function getAuthorName(post: RpcLatestPost) {
  const nickname = normalizeText(post.author_nickname);

  if (nickname) {
    return nickname;
  }

  if (!post.author_user_name) {
    return '';
  }

  try {
    return decrypt(post.author_user_name);
  } catch {
    return '';
  }
}

export async function GET() {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({
        isLoggedIn: false,
        role: null,
        joinSites: [],
        statusSites: [],
      });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rpcResult = await supabaseAdmin.rpc('get_hub_user_join_sites', {
      p_auth_user_id: sessionClaims.userId,
    });

    if (rpcResult.error) {
      return Response.json(
        {
          error: '가입한 사이트 목록을 불러오지 못했습니다.',
        },
        { status: 500 },
      );
    }

    const result = rpcResult.data as RpcResult | null;

    if (!result?.user_found) {
      return Response.json(
        {
          error: '사용자 정보를 확인하지 못했습니다.',
        },
        { status: 500 },
      );
    }

    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('id')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigmaResult.error || !stigmaResult.data) {
      return Response.json({ error: '사용자 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const membershipsResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select(
        'site_id, role, is_block, is_rejoin, blocked_at, block_term, kicked_at, kick_term, banned_at, ban_term, cleared_at, withdrawn_at',
      )
      .eq('user_id', stigmaResult.data.id);

    if (membershipsResult.error) {
      return Response.json({ error: '사이트 회원 상태를 불러오지 못했습니다.' }, { status: 500 });
    }

    const memberships = (membershipsResult.data ?? []) as MembershipRow[];
    const rpcSites = Array.isArray(result.join_sites) ? result.join_sites : [];
    const siteIds = [
      ...new Set([...rpcSites.map((site) => site.id), ...memberships.map((membership) => membership.site_id)].filter(Boolean)),
    ];
    const sitesResult =
      siteIds.length > 0
        ? await supabaseAdmin
            .from('rhizomes')
            .select(
              'id, site_key, site_label, site_type, profile_picture, profile_logo, is_shutdown, is_blocked, is_closed',
            )
            .in('id', siteIds)
        : { data: [], error: null };

    if (sitesResult.error) {
      return Response.json({ error: '사이트 운영 상태를 불러오지 못했습니다.' }, { status: 500 });
    }

    const sites = (sitesResult.data ?? []) as SiteRow[];
    const siteMap = new Map(sites.map((site) => [site.id, site]));
    const subscriptionsResult =
      siteIds.length > 0
        ? await supabaseAdmin
            .from('subscriptions')
            .select('target_id, status, created_at')
            .eq('subscription_type', 'plan_billing')
            .eq('target_type', 'plan')
            .in('target_id', siteIds)
            .order('created_at', { ascending: false })
        : { data: [], error: null };

    if (subscriptionsResult.error) {
      return Response.json({ error: '사이트 요금제 상태를 불러오지 못했습니다.' }, { status: 500 });
    }

    const latestSubscriptionStatusMap = new Map<string, string | null>();

    for (const subscription of (subscriptionsResult.data ?? []) as SubscriptionRow[]) {
      if (!latestSubscriptionStatusMap.has(subscription.target_id)) {
        latestSubscriptionStatusMap.set(subscription.target_id, subscription.status);
      }
    }

    const membershipMap = new Map(memberships.map((membership) => [membership.site_id, membership]));

    const joinSites = rpcSites
      .map((site) => {
        const siteKey = normalizeText(site.site_key);
        const siteLabel = normalizeText(site.site_label);

        if (!site.id || !siteKey || !siteLabel) {
          return null;
        }

        const membership = membershipMap.get(site.id);

        if (membership && getMembershipStatus(membership)) {
          return null;
        }

        const siteRow = siteMap.get(site.id);
        const operationalStatus = siteRow
          ? getOperationalStatus(siteRow, latestSubscriptionStatusMap.get(site.id) ?? null)
          : 'normal';

        const latestPosts = (Array.isArray(site.latest_posts) ? site.latest_posts : []).map((post) => ({
          id: post.id,
          subject: normalizeText(post.subject),
          href: `/${post.board_key}/${post.slug}`,
          authorName: getAuthorName(post),
          commentCount: Number(post.comment_count) || 0,
          publishedAt: post.published_at,
        }));

        return {
          id: site.id,
          site_key: siteKey,
          site_label: siteLabel,
          site_type: normalizeText(site.site_type).toLowerCase(),
          profilePictureUrl: getPublicUrl('avatar', site.profile_picture),
          profileLogoUrl: getPublicUrl('site-logo', site.profile_logo),
          role: normalizeText(site.role).toLowerCase(),
          operationalStatus,
          operationalStatusLabel: getOperationalStatusLabel(operationalStatus),
          latestPosts,
        };
      })
      .filter(
        (
          site,
        ): site is {
          id: string;
          site_key: string;
          site_label: string;
          site_type: string;
          profilePictureUrl: string | null;
          profileLogoUrl: string | null;
          role: string;
          operationalStatus: SiteOperationalStatus;
          operationalStatusLabel: string;
          latestPosts: {
            id: string;
            subject: string;
            href: string;
            authorName: string;
            commentCount: number;
            publishedAt: string;
          }[];
        } => Boolean(site),
      );

    const now = Date.now();
    const statusOrder: Record<MembershipStatus, number> = { block: 0, kick: 1, ban: 2, rejoin: 3 };
    const statusSites = memberships
      .map((membership) => {
        const membershipStatus = getMembershipStatus(membership);
        const site = siteMap.get(membership.site_id);

        if (!membershipStatus || !site) {
          return null;
        }

        const siteKey = normalizeText(site.site_key);
        const siteLabel = normalizeText(site.site_label) || siteKey;

        if (!siteKey || !siteLabel) {
          return null;
        }

        const rejoinAt =
          membershipStatus === 'kick'
            ? membership.kick_term
            : membershipStatus === 'ban'
              ? membership.ban_term
              : null;
        const rejoinAtTime = rejoinAt ? new Date(rejoinAt).getTime() : Number.NaN;
        const canRejoin = membershipStatus === 'rejoin' || (Number.isFinite(rejoinAtTime) && rejoinAtTime <= now);
        const daysUntilRejoin =
          !canRejoin && Number.isFinite(rejoinAtTime) ? Math.max(1, Math.ceil((rejoinAtTime - now) / 86_400_000)) : null;
        const operationalStatus = getOperationalStatus(site, latestSubscriptionStatusMap.get(site.id) ?? null);

        return {
          id: site.id,
          site_key: siteKey,
          site_label: siteLabel,
          site_type: normalizeText(site.site_type).toLowerCase(),
          profilePictureUrl: getPublicUrl('avatar', site.profile_picture),
          profileLogoUrl: getPublicUrl('site-logo', site.profile_logo),
          role: normalizeText(membership.role).toLowerCase(),
          membershipStatus,
          statusAt:
            membershipStatus === 'block'
              ? membership.blocked_at
              : membershipStatus === 'kick'
                ? membership.kicked_at
                : membershipStatus === 'ban'
                  ? membership.banned_at
                  : membership.cleared_at,
          rejoinAt,
          canRejoin,
          daysUntilRejoin,
          operationalStatus,
          operationalStatusLabel: getOperationalStatusLabel(operationalStatus),
          latestPosts: [],
        };
      })
      .filter((site): site is NonNullable<typeof site> => Boolean(site))
      .sort((a, b) => statusOrder[a.membershipStatus] - statusOrder[b.membershipStatus]);

    return Response.json({
      isLoggedIn: true,
      role: result.role ?? null,
      joinSites,
      statusSites,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        {
          error: unknownError.message || '사용자 정보를 불러오지 못했습니다.',
        },
        { status: 500 },
      );
    }

    return Response.json(
      {
        error: '사용자 정보를 불러오지 못했습니다.',
      },
      { status: 500 },
    );
  }
}
