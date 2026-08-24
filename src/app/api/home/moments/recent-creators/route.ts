import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type PostRow = {
  subject: string | null;
  summary: string | null;
  content_html: string | null;
  images: Array<{ path: string }> | null;
  published_at: string | null;
  slug: number | null;
  user_id: string;
  post_count: number | null;
  thumbnail_image: string | null;
  youtube_id: string | null;
  site: Array<{
    site_key: string;
    site_label: string;
    site_type: string;
    profile_picture: string | null;
    promotion_image: string | null;
  }>;
  board: Array<{ board_key: string; board_type: string }>;
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
  const limit = parseInt(searchParams.get('limit') || '100', 10);

  const supabaseAdmin = getSupabaseAdmin();

  try {
    const { data: banques, error } = await supabaseAdmin
      .from('chorogons_banque')
      .select('chorogon_id, updated_at')
      .eq('is_author', true)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const chorogonIds = banques.map((b) => b.chorogon_id);
    const userIds: string[] = [];

    if (chorogonIds.length > 0) {
      const { data: chorogons } = await supabaseAdmin.from('chorogons').select('id, user_id').in('id', chorogonIds);

      if (chorogons) {
        chorogons.forEach((c) => {
          if (c.user_id) {
            userIds.push(c.user_id);
          }
        });
      }
    }

    if (userIds.length === 0) {
      return NextResponse.json({ posts: [] });
    }

    const { data: recentPostsResult, error: postsError } = await supabaseAdmin
      .from('posts')
      .select(
        `
        id, subject, summary, content_html, images, published_at, slug, user_id, post_count, thumbnail_image, youtube_id,
        site:rhizomes!posts_site_id_fkey(site_key, site_label, site_type, profile_picture, promotion_image),
        board:boards(board_key, board_type)
      `,
      )
      .in('user_id', userIds)
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (postsError) throw postsError;

    const uniqueUserPostsMap = new Map<string, PostRow>();
    ((recentPostsResult ?? []) as PostRow[]).forEach((post) => {
      if (!uniqueUserPostsMap.has(post.user_id)) {
        uniqueUserPostsMap.set(post.user_id, post);
      }
    });
    const uniqueRecentPosts = Array.from(uniqueUserPostsMap.values());

    const postUserIds = Array.from(new Set(uniqueRecentPosts.map((post) => post.user_id).filter(Boolean)));
    const stigmasMap = new Map<string, StigmaRow>();

    if (postUserIds.length > 0) {
      const { data: stigmas } = await supabaseAdmin
        .from('stigmas')
        .select('id, user_name, avatar')
        .in('id', postUserIds);

      if (stigmas) {
        stigmas.forEach((stigma) => stigmasMap.set(stigma.id, stigma as StigmaRow));
      }
    }

    const { decrypt } = await import('@/lib/encryption/decrypt');

    const posts = uniqueRecentPosts.map((post) => {
      const site = post.site[0] ?? null;
      const board = post.board[0] ?? null;
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
          Array.isArray(post.images) && post.images.length > 0 ? getPublicImageUrl('post', post.images[0].path) : null,
        thumbnail_image: getPublicImageUrl('og-image', post.thumbnail_image),
        youtube_id: post.youtube_id,
        post_count: post.post_count,
      };
    });

    return NextResponse.json({ posts });
  } catch (error) {
    console.error('[API home/moments/recent-creators]', error);
    return NextResponse.json({ error: 'Failed to load recent creators' }, { status: 500 });
  }
}
