import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

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
              'site_key, site_label, summary, site_type, profile_picture, promotion_image, created_at, post_count:posts(count)',
            )
            .in('id', siteIds)
        : { data: [], error: null },
      postIds.length > 0
        ? supabaseAdmin
            .from('posts')
            .select(
              `
            id, subject, summary, content_html, images, published_at, slug, user_id,
            site:rhizomes!posts_site_id_fkey(site_key, site_label, site_type, profile_picture, promotion_image),
            board:boards(board_key, board_type)
          `,
            )
            .in('id', postIds)
        : { data: [], error: null },
    ]);

    if (sitesResult.error) throw sitesResult.error;
    if (postsResult.error) throw postsResult.error;

    const userIds = Array.from(new Set((postsResult.data || []).map((p: any) => p.user_id).filter(Boolean)));
    const stigmasMap = new Map();

    if (userIds.length > 0) {
      const { data: stigmas } = await supabaseAdmin.from('stigmas').select('id, user_name, avatar').in('id', userIds);

      if (stigmas) {
        stigmas.forEach((s) => stigmasMap.set(s.id, s));
      }
    }

    const { decrypt } = await import('@/lib/encryption/decrypt');

    const sites = (sitesResult.data || [])
      .map((site: any) => ({
        site_key: site.site_key,
        site_label: site.site_label,
        summary: site.summary,
        site_type: site.site_type,
        profile_picture: getPublicImageUrl('avatar', site.profile_picture),
        promotion_image: getPublicImageUrl('promotion-image', site.promotion_image),
        created_at: site.created_at,
        post_count: site.post_count?.[0]?.count || 0,
      }))
      .slice(0, limit);

    const posts = (postsResult.data || [])
      .map((post: any) => {
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
          site_key: post.site?.site_key,
          site_label: post.site?.site_label,
          site_type: post.site?.site_type,
          profile_picture: getPublicImageUrl('avatar', post.site?.profile_picture),
          promotion_image: getPublicImageUrl('promotion-image', post.site?.promotion_image),
          slug: post.slug,
          board_key: post.board?.board_key,
          board_type: post.board?.board_type,
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
