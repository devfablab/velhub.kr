import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type FavoriteRow = {
  id: string;
  created_at: string;
  site_id: string;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
  profile_picture: string | null;
  profile_logo: string | null;
  visibility_type: string;
  is_shutdown: boolean;
};

type StigmaRow = {
  id: string;
};

type MemberRow = {
  site_id: string;
  role: string | null;
};

function getPublicUrl(bucket: string, value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return null;
  }

  if (/^https?:\/\//i.test(normalizedValue)) {
    return normalizedValue;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from(bucket).getPublicUrl(normalizedValue);

  return publicUrl.data.publicUrl ?? null;
}

export async function GET() {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ blogs: [] });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const favoritesResult = await supabaseAdmin
      .from('blog_favorites')
      .select('id, created_at, site_id')
      .eq('user_id', session.authUserId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (favoritesResult.error) {
      return Response.json({ error: '즐겨찾는 블로그 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const favoriteRows = (favoritesResult.data ?? []) as FavoriteRow[];
    const siteIds = favoriteRows.map((favorite) => favorite.site_id);

    if (siteIds.length === 0) {
      return Response.json({ blogs: [] });
    }

    const [sitesResult, stigmaResult] = await Promise.all([
      supabaseAdmin
        .from('rhizomes')
        .select('id, site_key, site_label, profile_picture, profile_logo, visibility_type, is_shutdown')
        .in('id', siteIds)
        .eq('site_type', 'blog'),
      supabaseAdmin.from('stigmas').select('id').eq('user_id', session.authUserId).maybeSingle(),
    ]);

    if (sitesResult.error || stigmaResult.error) {
      return Response.json({ error: '즐겨찾는 블로그 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const sites = (sitesResult.data ?? []) as SiteRow[];
    const stigma = stigmaResult.data as StigmaRow | null;
    const siteMap = new Map(sites.map((site) => [site.id, site]));

    const membershipResult =
      stigma?.id && sites.length > 0
        ? await supabaseAdmin
            .from('rhizome_stigmas')
            .select('site_id, role')
            .eq('user_id', stigma.id)
            .in(
              'site_id',
              sites.map((site) => site.id),
            )
        : { data: [], error: null };

    if (membershipResult.error) {
      return Response.json({ error: '즐겨찾는 블로그 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const memberRows = (membershipResult.data ?? []) as MemberRow[];
    const roleMap = new Map(memberRows.map((member) => [member.site_id, normalizeText(member.role)]));

    const blogs = favoriteRows
      .map((favorite) => {
        const site = siteMap.get(favorite.site_id);

        if (!site) {
          return null;
        }

        const role = roleMap.get(site.id) ?? '';
        const canViewShutdownBlog = role === 'owner' || role === 'manager';

        if (site.is_shutdown && !canViewShutdownBlog) {
          return null;
        }

        return {
          id: favorite.id,
          siteName: site.site_key,
          siteLabel: site.site_label || site.site_key,
          visibilityType: site.visibility_type,
          visibilityLabel: site.visibility_type === 'private' ? '비공개' : '공개',
          isShutdown: site.is_shutdown,
          profilePictureUrl: getPublicUrl('avatar', site.profile_picture),
          profileLogoUrl: getPublicUrl('site-logo', site.profile_logo),
          href: `/${site.site_key}`,
          favoritedAt: favorite.created_at,
        };
      })
      .filter(Boolean);

    return Response.json({ blogs });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        { error: unknownError.message || '즐겨찾는 블로그 목록을 불러오지 못했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ error: '즐겨찾는 블로그 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
