import { NextResponse } from 'next/server';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
    contentId: string;
  }>;
};

type PostImageRow = {
  path?: string | null;
  width?: number | null;
  height?: number | null;
};

type LevelRow = {
  id: string;
  lv: number;
  icon: string | null;
  name: string | null;
};

const AVATAR_BUCKET = 'avatar';
const LEVEL_ICON_BUCKET = 'lv-icon';

function isNumericSlug(value: string) {
  return /^\d+$/.test(value);
}

function isExternalUrl(value: string) {
  return value.startsWith('http://') || value.startsWith('https://');
}

function isSupabaseStorageValue(value: string | null | undefined) {
  return Boolean(value && value.startsWith('supabase:'));
}

function getStoragePath(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  if (isSupabaseStorageValue(value)) {
    return value.replace('supabase:', '').trim();
  }

  return value.trim();
}

function getPublicPostImageUrl(path: string | null | undefined) {
  const normalizedPath = normalizeText(path);

  if (!normalizedPath) {
    return '';
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from('post').getPublicUrl(normalizedPath);

  return publicUrl.data.publicUrl ?? '';
}

function getAvatarUrl(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '';
  }

  if (isExternalUrl(normalizedValue)) {
    return normalizedValue;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from(AVATAR_BUCKET).getPublicUrl(normalizedValue);

  return publicUrl.data.publicUrl ?? '';
}

function getLevelIconUrl(value: string | null | undefined) {
  const targetPath = getStoragePath(value);

  if (!targetPath) {
    return '';
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from(LEVEL_ICON_BUCKET).getPublicUrl(targetPath);

  return publicUrl.data.publicUrl ?? '';
}

function normalizeImages(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return (value as PostImageRow[])
    .map((image) => {
      const path = normalizeText(image.path);

      if (!path) {
        return null;
      }

      return {
        path,
        url: getPublicPostImageUrl(path),
        width: typeof image.width === 'number' && Number.isFinite(image.width) ? Math.floor(image.width) : null,
        height: typeof image.height === 'number' && Number.isFinite(image.height) ? Math.floor(image.height) : null,
      };
    })
    .filter(Boolean);
}

async function getUserDisplayInfo(siteId: string, userId: string | null | undefined) {
  const normalizedUserId = normalizeText(userId);

  if (!normalizedUserId) {
    return {
      name: '',
      avatarUrl: '',
      level: null,
    };
  }

  const supabaseAdmin = getSupabaseAdmin();

  const membershipResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('nickname, lv')
    .eq('site_id', siteId)
    .eq('user_id', normalizedUserId)
    .maybeSingle();

  let name = '';
  let level: {
    id: string;
    lv: number;
    name: string;
    icon: string | null;
    iconUrl: string;
  } | null = null;

  if (!membershipResult.error && membershipResult.data?.nickname) {
    name = normalizeText(membershipResult.data.nickname);
  }

  const levelId = normalizeText(membershipResult.data?.lv);

  if (levelId) {
    const levelResult = await supabaseAdmin
      .from('community_levels')
      .select('id, lv, icon, name')
      .eq('site_id', siteId)
      .eq('id', levelId)
      .maybeSingle();

    if (!levelResult.error && levelResult.data) {
      const levelData = levelResult.data as LevelRow;

      level = {
        id: levelData.id,
        lv: levelData.lv,
        name: normalizeText(levelData.name) || String(levelData.lv),
        icon: levelData.icon,
        iconUrl: getLevelIconUrl(levelData.icon),
      };
    }
  }

  const stigmaResult = await supabaseAdmin
    .from('stigmas')
    .select('user_name, avatar')
    .eq('user_id', normalizedUserId)
    .maybeSingle();

  let avatarUrl = '';

  if (!stigmaResult.error && stigmaResult.data) {
    avatarUrl = getAvatarUrl(stigmaResult.data.avatar ?? null);

    if (!name && stigmaResult.data.user_name) {
      try {
        name = decrypt(stigmaResult.data.user_name as string);
      } catch {
        name = '';
      }
    }
  }

  return {
    name,
    avatarUrl,
    level,
  };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { boardName, contentId } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();
    const normalizedContentId = normalizeText(contentId);

    if (!normalizedBoardName) {
      return NextResponse.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!normalizedContentId) {
      return NextResponse.json({ error: 'contentId가 유효하지 않습니다.' }, { status: 400 });
    }

    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return NextResponse.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin
      .from('rhizomes')
      .select('id, visibility_type, is_shutdown')
      .eq('site_key', siteName)
      .maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return NextResponse.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    const isStaff = session.case === 'staff';

    if (rhizome.data.visibility_type !== 'public' || rhizome.data.is_shutdown !== false) {
      if (!isStaff) {
        return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    const board = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_label, board_type, markdown_status, site_id, post_type')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return NextResponse.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (board.data.board_type === 'page') {
      const pageQuery = supabaseAdmin
        .from('pages')
        .select(
          'id, slug, subject, summary, content_html, content_markdown, edited_at, sort_order, user_id, site_id, board_id, created_at, og_image, og_image_url, attachment_slug, attachment_origin, is_comment',
        )
        .eq('site_id', rhizome.data.id)
        .eq('board_id', board.data.id);

      const page = isNumericSlug(normalizedContentId)
        ? await pageQuery.eq('slug', Number(normalizedContentId)).maybeSingle()
        : await pageQuery.eq('id', normalizedContentId).maybeSingle();

      if (page.error || !page.data) {
        return NextResponse.json({ error: '페이지를 찾을 수 없습니다.' }, { status: 404 });
      }

      const author = await getUserDisplayInfo(rhizome.data.id, page.data.user_id);
      const isAuthor = Boolean(session.authUserId) && page.data.user_id === session.authUserId;

      return NextResponse.json({
        board: board.data,
        content: {
          ...page.data,
          slug: String(page.data.slug),
          author_name: author.name,
          author_avatar_url: author.avatarUrl,
          author_level: author.level,
        },
        isAuthor,
        isStaff,
      });
    }

    const postQuery = supabaseAdmin
      .from('posts')
      .select(
        'id, slug, subject, summary, content_html, content_markdown, content_simple, edited_at, thumbnail_image, thumbnail_width, thumbnail_height, youtube_url, youtube_id, youtube_created_at, images, poll, hashtags, idx, user_id, site_id, board_id, created_at, is_closed, closed_by, closed_at, closed_message, categories, series_id, prefix_id, published_status, published_at, is_comment, post_count, is_pin',
      )
      .eq('site_id', rhizome.data.id)
      .eq('board_id', board.data.id);

    const post = isNumericSlug(normalizedContentId)
      ? await postQuery.eq('slug', Number(normalizedContentId)).maybeSingle()
      : await postQuery.eq('id', normalizedContentId).maybeSingle();

    if (post.error || !post.data) {
      return NextResponse.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
    }

    const isAuthor = Boolean(session.authUserId) && post.data.user_id === session.authUserId;

    if (post.data.published_status === 'draft' && !isAuthor) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    if (post.data.is_closed === true && !isStaff) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const author = await getUserDisplayInfo(rhizome.data.id, post.data.user_id);
    const closedBy = await getUserDisplayInfo(rhizome.data.id, post.data.closed_by);

    const categoryIds = Array.isArray(post.data.categories)
      ? post.data.categories.filter((value: unknown): value is string => typeof value === 'string' && Boolean(value))
      : [];

    let categories: Array<{
      id: string;
      category_key: string;
      category_label: string;
      summary: string | null;
      thumbnail_image: string | null;
      sort_order: number;
      board_id: string;
      site_id: string;
      created_at?: string;
    }> = [];

    if (categoryIds.length > 0) {
      const categoryResult = await supabaseAdmin
        .from('board_categories')
        .select('id, category_key, category_label, summary, thumbnail_image, sort_order, board_id, site_id, created_at')
        .eq('site_id', rhizome.data.id)
        .eq('board_id', board.data.id)
        .in('id', categoryIds)
        .order('sort_order', { ascending: true });

      if (categoryResult.error) {
        return NextResponse.json({ error: '카테고리 정보를 불러오지 못했습니다.' }, { status: 500 });
      }

      categories = categoryResult.data ?? [];
    }

    let series: {
      id: string;
      created_at: string;
      series_key: string;
      series_label: string;
      summary: string | null;
      thumbnail_image: string | null;
      board_id: string;
      site_id: string;
      last_published_at: string | null;
      is_completed: boolean;
      user_id: string | null;
    } | null = null;

    if (post.data.series_id) {
      const seriesResult = await supabaseAdmin
        .from('board_series')
        .select(
          'id, created_at, series_key, series_label, summary, thumbnail_image, board_id, site_id, last_published_at, is_completed, user_id',
        )
        .eq('site_id', rhizome.data.id)
        .eq('board_id', board.data.id)
        .eq('id', post.data.series_id)
        .maybeSingle();

      if (seriesResult.error) {
        return NextResponse.json({ error: '연재 정보를 불러오지 못했습니다.' }, { status: 500 });
      }

      series = seriesResult.data ?? null;
    }

    let prefixes: Array<{ id: string; prefix_label: string }> = [];
    let prefixLabel: string | null = null;

    if (board.data.post_type === 'prefix') {
      const prefixResult = await supabaseAdmin
        .from('board_prefixes')
        .select('id, prefix_label')
        .eq('site_id', rhizome.data.id)
        .eq('board_id', board.data.id)
        .order('prefix_key', { ascending: true });

      if (prefixResult.error) {
        return NextResponse.json({ error: '말머리 정보를 불러오지 못했습니다.' }, { status: 500 });
      }

      prefixes = prefixResult.data ?? [];
      prefixLabel = prefixes.find((prefix) => prefix.id === post.data.prefix_id)?.prefix_label ?? null;
    }

    const postCount = typeof post.data.post_count === 'number' ? Number(post.data.post_count) : 0;
    const thumbnailImageUrl = getPublicPostImageUrl(post.data.thumbnail_image);

    return NextResponse.json({
      board: board.data,
      content: {
        ...post.data,
        slug: String(post.data.slug),
        author_name: author.name,
        author_avatar_url: author.avatarUrl,
        author_level: author.level,
        closed_by_name: closedBy.name,
        prefix_label: prefixLabel,
        thumbnail_image_url: thumbnailImageUrl,
        images: normalizeImages(post.data.images),
        post_count: postCount,
      },
      categories,
      series,
      prefixes,
      isAuthor,
      isStaff,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return NextResponse.json(
        { error: unknownError.message || '게시글 정보를 불러오지 못했습니다.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ error: '게시글 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
