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

    const joinSites = (Array.isArray(result.join_sites) ? result.join_sites : [])
      .map((site) => {
        const siteKey = normalizeText(site.site_key);
        const siteLabel = normalizeText(site.site_label);

        if (!site.id || !siteKey || !siteLabel) {
          return null;
        }

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

    return Response.json({
      isLoggedIn: true,
      role: result.role ?? null,
      joinSites,
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
