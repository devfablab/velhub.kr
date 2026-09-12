import { NextResponse } from 'next/server';
import { hasMembershipFeature } from '@/lib/memberships/features';
import { getPublicSiteUrl } from '@/lib/siteUrl';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SiteRow = {
  id: string;
  owner_id: string | null;
  site_key: string;
  site_label: string;
  summary: string | null;
  site_type: string;
  profile_picture: string | null;
  promotion_image: string | null;
  created_at: string;
  custom_domain: string | null;
  post_count: Array<{ count: number }> | null;
};

type PostRow = {
  subject: string | null;
  summary: string | null;
  content_html: string | null;
  images: Array<{ path: string }> | null;
  published_at: string | null;
  slug: number | null;
  user_id: string;
  site_id: string | null;
  board_id: string | null;
};

type BoardRow = {
  id: string;
  board_key: string;
  board_type: string;
};

type StigmaRow = {
  id: string;
  user_name: string | null;
  avatar: string | null;
};

function getPublicImageUrl(bucket: string, path: string | null | undefined) {
  const normalizedPath = normalizeText(path);
  if (!normalizedPath) return null;
  if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) return normalizedPath;
  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from(bucket).getPublicUrl(normalizedPath);
  return publicUrl.data.publicUrl ?? null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  const supabaseAdmin = getSupabaseAdmin();

  try {
    const { data: selections, error: selectionsError } = await supabaseAdmin
      .from('membership_selectors')
      .select('selector_type, target_id, user_id')
      .in('selector_type', ['creator_site', 'creator_own_post', 'creator_other_post'])
      .limit(limit * 3);

    if (selectionsError) throw selectionsError;

    const siteIds = selections.filter((s) => s.selector_type === 'creator_site').map((s) => s.target_id);

    const postIds = selections
      .filter((s) => s.selector_type === 'creator_own_post' || s.selector_type === 'creator_other_post')
      .map((s) => s.target_id);

    const [sitesResult, postsResult] = await Promise.all([
      siteIds.length > 0
        ? supabaseAdmin
            .from('rhizomes')
            .select(
              'id, owner_id, site_key, site_label, summary, site_type, profile_picture, promotion_image, created_at, custom_domain, post_count:posts(count)',
            )
            .in('id', siteIds)
        : { data: [], error: null },
      postIds.length > 0
        ? supabaseAdmin
            .from('posts')
            .select(
              `
            id, site_id, board_id, subject, summary, content_html, images, published_at, slug, user_id
          `,
            )
            .in('id', postIds)
        : { data: [], error: null },
    ]);

    if (sitesResult.error) throw sitesResult.error;
    if (postsResult.error) throw postsResult.error;

    const postRows = (postsResult.data ?? []) as PostRow[];
    const selectedSiteRows = (sitesResult.data ?? []) as SiteRow[];
    const selectedSiteIds = new Set(selectedSiteRows.map((site) => site.id));
    const additionalSiteIds = Array.from(
      new Set(postRows.map((post) => post.site_id).filter((siteId): siteId is string => Boolean(siteId))),
    ).filter((siteId) => !selectedSiteIds.has(siteId));
    const additionalSitesResult =
      additionalSiteIds.length > 0
        ? await supabaseAdmin
            .from('rhizomes')
            .select(
              'id, owner_id, site_key, site_label, summary, site_type, profile_picture, promotion_image, created_at, custom_domain, post_count:posts(count)',
            )
            .in('id', additionalSiteIds)
        : { data: [], error: null };

    if (additionalSitesResult.error) throw additionalSitesResult.error;

    const siteRows = [...selectedSiteRows, ...((additionalSitesResult.data ?? []) as SiteRow[])];
    const siteMap = new Map(siteRows.map((site) => [site.id, site]));
    const boardIds = Array.from(
      new Set(postRows.map((post) => post.board_id).filter((boardId): boardId is string => Boolean(boardId))),
    );
    const boardsResult =
      boardIds.length > 0
        ? await supabaseAdmin.from('boards').select('id, board_key, board_type').in('id', boardIds)
        : { data: [], error: null };

    if (boardsResult.error) throw boardsResult.error;

    const boardMap = new Map(((boardsResult.data ?? []) as BoardRow[]).map((board) => [board.id, board]));
    const ownerIds = Array.from(
      new Set(siteRows.map((site) => site.owner_id).filter((ownerId): ownerId is string => Boolean(ownerId))),
    );
    const ownerDomainFeatures = new Map(
      await Promise.all(
        ownerIds.map(async (ownerId) => [ownerId, await hasMembershipFeature(ownerId, 'owner_domain')] as const),
      ),
    );
    const userIds = Array.from(new Set(postRows.map((post) => post.user_id).filter(Boolean)));
    const stigmasMap = new Map<string, StigmaRow>();

    if (userIds.length > 0) {
      const { data: stigmas } = await supabaseAdmin.from('stigmas').select('id, user_name, avatar').in('id', userIds);

      if (stigmas) {
        stigmas.forEach((stigma) => stigmasMap.set(stigma.id, stigma as StigmaRow));
      }
    }

    const { decrypt } = await import('@/lib/encryption/decrypt');

    const sites = siteRows
      .map((site) => ({
        site_key: site.site_key,
        site_url: getPublicSiteUrl({
          siteKey: site.site_key,
          customDomain: site.custom_domain,
          hasOwnerDomainFeature: ownerDomainFeatures.get(site.owner_id ?? '') === true,
        }),
        site_label: site.site_label,
        summary: site.summary,
        site_type: site.site_type,
        profile_picture: getPublicImageUrl('avatar', site.profile_picture),
        promotion_image: getPublicImageUrl('promotion-image', site.promotion_image),
        created_at: site.created_at,
        post_count: site.post_count?.[0]?.count || 0,
      }))
      .slice(0, limit);

    const posts = postRows
      .map((post) => {
        const site = post.site_id ? (siteMap.get(post.site_id) ?? null) : null;
        const board = post.board_id ? (boardMap.get(post.board_id) ?? null) : null;
        const stigma = stigmasMap.get(post.user_id);
        let authorName = '';
        if (stigma?.user_name) {
          try {
            authorName = decrypt(stigma.user_name);
          } catch {
            authorName = '';
          }
        }

        return {
          site_key: site?.site_key,
          site_url: site
            ? getPublicSiteUrl({
                siteKey: site.site_key,
                customDomain: site.custom_domain,
                hasOwnerDomainFeature: ownerDomainFeatures.get(site.owner_id ?? '') === true,
              })
            : null,
          site_label: site?.site_label,
          site_type: site?.site_type,
          profile_picture: getPublicImageUrl('avatar', site?.profile_picture),
          promotion_image: getPublicImageUrl('promotion-image', site?.promotion_image),
          slug: post.slug,
          board_key: board?.board_key,
          board_type: board?.board_type,
          author_name: authorName,
          author_avatar: getPublicImageUrl('avatar', stigma?.avatar),
          published_at: post.published_at,
          subject: post.subject,
          summary: post.summary,
          content_html: post.content_html,
          image:
            Array.isArray(post.images) && post.images.length > 0
              ? getPublicImageUrl('post', post.images[0].path)
              : null,
        };
      })
      .slice(0, limit);

    return NextResponse.json({ sites, posts });
  } catch (error) {
    console.error('[API home/moments/support]', error);
    return NextResponse.json({ error: 'Failed to load support moments' }, { status: 500 });
  }
}
