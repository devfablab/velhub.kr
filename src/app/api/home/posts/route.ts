import { type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { decrypt } from '@/lib/encryption/decrypt';

function getPublicImageUrl(bucket: string, path: string | null | undefined) {
  const normalizedPath = normalizeText(path);

  if (!normalizedPath) {
    return null;
  }

  if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
    return normalizedPath;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from(bucket).getPublicUrl(normalizedPath);

  return publicUrl.data.publicUrl ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sortBy = searchParams.get('sortBy') === 'post_count' ? 'post_count' : 'published_at';
    const limitParam = searchParams.get('limit') ?? '10';
    const limit = parseInt(limitParam, 10);
    const siteType = searchParams.get('siteType');

    const supabaseAdmin = getSupabaseAdmin();

    let rhizomesQuery = supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_label, site_type, profile_picture')
      .eq('visibility_type', 'public')
      .eq('is_shutdown', false)
      .eq('is_blocked', false);

    if (siteType) {
      rhizomesQuery = rhizomesQuery.eq('site_type', siteType);
    }

    const rhizomesResult = await rhizomesQuery;

    if (rhizomesResult.error || !rhizomesResult.data || rhizomesResult.data.length === 0) {
      return Response.json({ posts: [] });
    }

    const rhizomes = rhizomesResult.data;
    const rhizomeMap = new Map(rhizomes.map((rhizome) => [rhizome.id, rhizome]));

    const siteIds = rhizomes.map((rhizome) => rhizome.id);

    const boardsResult = await supabaseAdmin
      .from('boards')
      .select('id, board_type, board_key, site_id')
      .neq('board_type', 'page')
      .in('site_id', siteIds);

    if (boardsResult.error || !boardsResult.data || boardsResult.data.length === 0) {
      return Response.json({ posts: [] });
    }

    const boards = boardsResult.data;
    const boardIds = boards.map((board) => board.id);
    const boardMap = new Map(boards.map((board) => [board.id, board]));

    const postsResult = await supabaseAdmin
      .from('posts')
      .select(
        'slug, subject, summary, content_html, content_simple, images, thumbnail_image, thumbnail_width, thumbnail_height, youtube_id, youtube_created_at, published_at, post_count, board_id, user_id',
      )
      .eq('is_closed', false)
      .not('published_at', 'is', null)
      .in('board_id', boardIds)
      .order(sortBy, { ascending: false })
      .limit(limit);

    if (postsResult.error || !postsResult.data) {
      return Response.json({ error: '데이터를 불러오지 못했습니다.' }, { status: 500 });
    }

    const postsData = postsResult.data;
    const userIds = Array.from(new Set(postsData.map((post) => post.user_id).filter(Boolean)));

    const stigmasMap = new Map();
    const nicknamesMap = new Map();

    if (userIds.length > 0) {
      const stigmasResult = await supabaseAdmin
        .from('stigmas')
        .select('id, user_id, user_name, avatar')
        .in('user_id', userIds);

      if (!stigmasResult.error && stigmasResult.data) {
        const stigmaIds: string[] = [];

        stigmasResult.data.forEach((stigma) => {
          stigmasMap.set(stigma.user_id, stigma);
          if (stigma.id) {
            stigmaIds.push(stigma.id);
          }
        });

        if (stigmaIds.length > 0) {
          const rhizomeStigmasResult = await supabaseAdmin
            .from('rhizome_stigmas')
            .select('user_id, site_id, nickname')
            .in('user_id', stigmaIds)
            .in('site_id', siteIds);

          if (!rhizomeStigmasResult.error && rhizomeStigmasResult.data) {
            rhizomeStigmasResult.data.forEach((rhizom) => {
              nicknamesMap.set(`${rhizom.site_id}_${rhizom.user_id}`, normalizeText(rhizom.nickname));
            });
          }
        }
      }
    }

    const posts = postsData.map((post) => {
      const board = boardMap.get(post.board_id);
      const boardType = board?.board_type;
      const boardKey = board?.board_key;
      const siteId = board?.site_id;
      const rhizome = siteId ? rhizomeMap.get(siteId) : null;
      const stigma = stigmasMap.get(post.user_id);

      let authorName = '';

      if (stigma) {
        const nickname = nicknamesMap.get(`${siteId}_${stigma.id}`);

        if (nickname) {
          authorName = nickname;
        } else if (stigma.user_name) {
          try {
            authorName = decrypt(stigma.user_name);
          } catch {
            authorName = '';
          }
        }
      }

      const avatar = stigma ? getPublicImageUrl('avatar', stigma.avatar) : null;

      const base = {
        site_key: rhizome?.site_key,
        site_label: rhizome?.site_label,
        site_type: rhizome?.site_type,
        profile_picture: getPublicImageUrl('avatar', rhizome?.profile_picture),
        slug: post.slug,
        board_key: boardKey,
        board_type: boardType,
        author_name: authorName,
        author_avatar: avatar,
        published_at: post.published_at,
        post_count: post.post_count,
      };

      if (boardType === 'gallery') {
        return {
          ...base,
          subject: post.subject,
          summary: post.summary,
          content_html: post.content_html,
          image:
            Array.isArray(post.images) && post.images.length > 0
              ? getPublicImageUrl('post', post.images[0].path)
              : null,
        };
      }

      if (boardType === 'youtube') {
        return {
          ...base,
          subject: post.subject,
          summary: post.summary,
          thumbnail_image: getPublicImageUrl('post', post.thumbnail_image),
          thumbnail_width: post.thumbnail_width,
          thumbnail_height: post.thumbnail_height,
          youtube_id: post.youtube_id,
          youtube_created_at: post.youtube_created_at,
        };
      }

      if (boardType === 'feed') {
        return {
          ...base,
          content_simple: post.content_simple,
          image:
            Array.isArray(post.images) && post.images.length > 0
              ? getPublicImageUrl('post', post.images[0].path)
              : null,
        };
      }

      if (boardType === 'basic' || boardType === 'blog') {
        return {
          ...base,
          subject: post.subject,
          content_html: post.content_html,
          thumbnail_image: getPublicImageUrl('og-image', post.thumbnail_image),
        };
      }

      return base;
    });

    return Response.json({ posts });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message }, { status: 500 });
    }
    return Response.json({ error: '데이터를 불러오지 못했습니다.' }, { status: 500 });
  }
}
