import { type NextRequest } from 'next/server';
import { decrypt } from '@/lib/encryption/decrypt';
import { getUsersWithMembershipFeature } from '@/lib/memberships/features';
import { getPublicSiteUrl } from '@/lib/siteUrl';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type PostRow = {
  board_id: string;
  content_html: string | null;
  content_simple: string | null;
  images: unknown;
  like_count: number | null;
  post_count: number | null;
  published_at: string;
  slug: string;
  subject: string | null;
  summary: string | null;
  thumbnail_height: number | null;
  thumbnail_image: string | null;
  thumbnail_width: number | null;
  user_id: string | null;
  youtube_created_at: string | null;
  youtube_id: string | null;
  youtube_url: string | null;
};

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

function extractYoutubeId(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return null;
  }

  const matched = normalizedValue.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^?&#/]+)/i);
  return matched?.[1] ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sortByParam = searchParams.get('sortBy');
    const sortBy =
      sortByParam === 'like_count' ? 'like_count' : sortByParam === 'post_count' ? 'post_count' : 'published_at';
    const limitParam = searchParams.get('limit') ?? '10';
    const limit = parseInt(limitParam, 10);
    const siteType = searchParams.get('siteType');

    const supabaseAdmin = getSupabaseAdmin();

    const candidateBatchSize = Math.max(limit * 5, 100);
    const postsData: PostRow[] = [];
    const boardMap = new Map<string, { id: string; board_type: string; board_key: string; site_id: string }>();
    const rhizomeMap = new Map<
      string,
      {
        id: string;
        owner_id: string | null;
        site_key: string;
        site_label: string;
        site_type: string;
        profile_picture: string | null;
        promotion_image: string | null;
        custom_domain: string | null;
      }
    >();
    let offset = 0;

    while (postsData.length < limit) {
      const postsResult = await supabaseAdmin
        .from('posts')
        .select(
          'slug, subject, summary, content_html, content_simple, images, thumbnail_image, thumbnail_width, thumbnail_height, youtube_id, youtube_url, youtube_created_at, published_at, post_count, like_count, board_id, user_id',
        )
        .eq('is_closed', false)
        .eq('is_wording_blinded', false)
        .not('published_at', 'is', null)
        .order(sortBy, { ascending: false })
        .range(offset, offset + candidateBatchSize - 1);

      if (postsResult.error || !postsResult.data) {
        return Response.json({ error: '데이터를 불러오지 못했습니다.' }, { status: 500 });
      }

      const candidatePosts = postsResult.data as PostRow[];

      if (candidatePosts.length === 0) {
        break;
      }

      const candidateBoardIds = [...new Set(candidatePosts.map((post) => post.board_id))];
      const boardsResult = await supabaseAdmin
        .from('boards')
        .select('id, board_type, board_key, site_id')
        .neq('board_type', 'page')
        .in('id', candidateBoardIds);

      if (boardsResult.error) {
        return Response.json({ error: '데이터를 불러오지 못했습니다.' }, { status: 500 });
      }

      const candidateBoards = boardsResult.data ?? [];
      const candidateBoardMap = new Map(candidateBoards.map((board) => [board.id, board]));
      const candidateSiteIds = [...new Set(candidateBoards.map((board) => board.site_id))];
      let rhizomesQuery = supabaseAdmin
        .from('rhizomes')
        .select('id, owner_id, site_key, site_label, site_type, profile_picture, promotion_image, custom_domain')
        .eq('visibility_type', 'public')
        .eq('is_shutdown', false)
        .or('is_blocked.eq.false,is_blocked.is.null')
        .in('id', candidateSiteIds);

      if (siteType) {
        rhizomesQuery = rhizomesQuery.eq('site_type', siteType);
      }

      const rhizomesResult = await rhizomesQuery;

      if (rhizomesResult.error) {
        return Response.json({ error: '데이터를 불러오지 못했습니다.' }, { status: 500 });
      }

      const candidateRhizomeMap = new Map((rhizomesResult.data ?? []).map((rhizome) => [rhizome.id, rhizome]));

      candidatePosts.forEach((post) => {
        const board = candidateBoardMap.get(post.board_id);
        const rhizome = board ? candidateRhizomeMap.get(board.site_id) : null;

        if (!board || !rhizome || postsData.length >= limit) {
          return;
        }

        postsData.push(post);
        boardMap.set(board.id, board);
        rhizomeMap.set(rhizome.id, rhizome);
      });

      if (candidatePosts.length < candidateBatchSize) {
        break;
      }

      offset += candidateBatchSize;
    }

    if (postsData.length === 0) {
      return Response.json({ posts: [] });
    }

    const siteIds = [...rhizomeMap.keys()];
    const ownerIds = [
      ...new Set(
        [...rhizomeMap.values()]
          .map((rhizome) => rhizome.owner_id)
          .filter((ownerId): ownerId is string => Boolean(ownerId)),
      ),
    ];
    const ownerIdsWithDomainFeature = await getUsersWithMembershipFeature(ownerIds, 'owner_domain');
    const userIds = Array.from(new Set(postsData.map((post) => post.user_id).filter(Boolean)));

    const stigmasMap = new Map();
    const nicknamesMap = new Map();

    if (userIds.length > 0) {
      const stigmasResult = await supabaseAdmin
        .from('stigmas')
        .select('id, user_id, user_name, avatar')
        .in('id', userIds);

      if (!stigmasResult.error && stigmasResult.data) {
        const stigmaIds: string[] = [];

        stigmasResult.data.forEach((stigma) => {
          stigmasMap.set(stigma.id, stigma);
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
        site_url: rhizome
          ? getPublicSiteUrl({
              siteKey: rhizome.site_key,
              customDomain: rhizome.custom_domain,
              hasOwnerDomainFeature: ownerIdsWithDomainFeature.has(rhizome.owner_id),
            })
          : null,
        site_label: rhizome?.site_label,
        site_type: rhizome?.site_type,
        profile_picture: getPublicImageUrl('avatar', rhizome?.profile_picture),
        promotion_image: getPublicImageUrl('promotion-image', rhizome?.promotion_image),
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
          youtube_id: post.youtube_id || extractYoutubeId(post.youtube_url),
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
