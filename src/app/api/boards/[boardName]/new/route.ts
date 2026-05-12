import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
  }>;
};

type PollOptionImageRow = {
  path: string;
  url: string;
  width: number | null;
  height: number | null;
};

type PollOptionRow = {
  id: number;
  label: string;
  image: PollOptionImageRow | null;
};

type PollRow = {
  question: string;
  creator_id: string;
  anonymity: 'anonymous' | 'named';
  endType: 'absolute' | 'relative';
  endsAt: string;
  options: PollOptionRow[];
};

type ImageRow = {
  path: string;
  width: number | null;
  height: number | null;
};

type RequestBody = {
  siteName: string | null;
  action?: 'draft' | 'publish' | null;
  subject?: string | null;
  summary?: string | null;
  contentHtml?: string | null;
  contentMarkdown?: string | null;
  contentSimple?: string | null;
  thumbnailImage?: string | null;
  thumbnailWidth?: number | null;
  thumbnailHeight?: number | null;
  youtubeUrl?: string | null;
  youtubeCreatedAt?: string | null;
  images?: unknown;
  poll?: unknown;
  categories?: string[] | null;
  hashtags?: string[] | null;
  seriesKey?: string | null;
  prefixId?: string | null;
  isComment?: boolean | null;
  isPin?: boolean | null;
};

function isValidCategoryKey(value: string) {
  if (value.length < 2 || value.length > 16) {
    return false;
  }

  if (!/[a-z]/.test(value)) {
    return false;
  }

  if (/[^a-z0-9\-_]/.test(value)) {
    return false;
  }

  if (value.startsWith('_') || value.endsWith('_')) {
    return false;
  }

  if (value.includes('__')) {
    return false;
  }

  return true;
}

function isValidSeriesKey(value: string) {
  if (value.length < 5 || value.length > 16) {
    return false;
  }

  if (!/[a-z]/.test(value)) {
    return false;
  }

  if (/[^a-z0-9\-_]/.test(value)) {
    return false;
  }

  if (value.startsWith('_') || value.endsWith('_')) {
    return false;
  }

  if (value.includes('__')) {
    return false;
  }

  return true;
}

function normalizeHashtags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === 'string' ? normalizeText(item) : ''))
        .filter(Boolean)
        .map((item) => (item.startsWith('#') ? item.slice(1) : item))
        .map((item) => item.replace(/\s+/g, ' '))
        .filter(Boolean),
    ),
  );
}

function normalizeImages(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as ImageRow[];
  }

  const normalizedImages: ImageRow[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const rawItem = item as {
      path?: unknown;
      width?: unknown;
      height?: unknown;
    };

    const path = typeof rawItem.path === 'string' ? normalizeText(rawItem.path) : '';

    if (!path) {
      continue;
    }

    const width =
      typeof rawItem.width === 'number' && Number.isFinite(rawItem.width) ? Math.floor(rawItem.width) : null;
    const height =
      typeof rawItem.height === 'number' && Number.isFinite(rawItem.height) ? Math.floor(rawItem.height) : null;

    normalizedImages.push({
      path,
      width,
      height,
    });
  }

  return normalizedImages.slice(0, 9);
}

function normalizePollImage(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const rawValue = value as {
    path?: unknown;
    url?: unknown;
    width?: unknown;
    height?: unknown;
  };

  const path = typeof rawValue.path === 'string' ? normalizeText(rawValue.path) : '';
  const url = typeof rawValue.url === 'string' ? normalizeText(rawValue.url) : '';

  if (!path || !url) {
    return null;
  }

  const width =
    typeof rawValue.width === 'number' && Number.isFinite(rawValue.width) ? Math.floor(rawValue.width) : null;
  const height =
    typeof rawValue.height === 'number' && Number.isFinite(rawValue.height) ? Math.floor(rawValue.height) : null;

  return {
    path,
    url,
    width,
    height,
  } satisfies PollOptionImageRow;
}

function normalizePoll(value: unknown, creatorId: string) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const rawValue = value as {
    question?: unknown;
    anonymity?: unknown;
    endType?: unknown;
    endsAt?: unknown;
    options?: unknown;
  };

  const question = typeof rawValue.question === 'string' ? normalizeText(rawValue.question) : '';
  const anonymity = rawValue.anonymity === 'anonymous' || rawValue.anonymity === 'named' ? rawValue.anonymity : '';
  const endType = rawValue.endType === 'absolute' || rawValue.endType === 'relative' ? rawValue.endType : '';
  const endsAt = typeof rawValue.endsAt === 'string' ? normalizeText(rawValue.endsAt) : '';

  if (!question) {
    return null;
  }

  if (!anonymity) {
    return 'INVALID_ANONYMITY';
  }

  if (!endType) {
    return 'INVALID_END_TYPE';
  }

  if (!endsAt) {
    return 'INVALID_END_AT';
  }

  const endDate = new Date(endsAt);

  if (Number.isNaN(endDate.getTime())) {
    return 'INVALID_END_AT';
  }

  const minimumEndDate = new Date();
  minimumEndDate.setSeconds(0, 0);
  minimumEndDate.setMinutes(minimumEndDate.getMinutes() + 1);

  if (endDate.getTime() < minimumEndDate.getTime()) {
    return 'INVALID_END_AT';
  }

  if (!Array.isArray(rawValue.options)) {
    return null;
  }

  const normalizedOptions = rawValue.options
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const rawOption = item as {
        label?: unknown;
        image?: unknown;
        imagePath?: unknown;
        imageUrl?: unknown;
        imageWidth?: unknown;
        imageHeight?: unknown;
      };

      const label = typeof rawOption.label === 'string' ? normalizeText(rawOption.label) : '';

      if (!label) {
        return null;
      }

      const directImage = normalizePollImage(rawOption.image);

      const imagePath = typeof rawOption.imagePath === 'string' ? normalizeText(rawOption.imagePath) : '';
      const imageUrl = typeof rawOption.imageUrl === 'string' ? normalizeText(rawOption.imageUrl) : '';

      const image =
        directImage ??
        (imagePath && imageUrl
          ? {
              path: imagePath,
              url: imageUrl,
              width:
                typeof rawOption.imageWidth === 'number' && Number.isFinite(rawOption.imageWidth)
                  ? Math.floor(rawOption.imageWidth)
                  : null,
              height:
                typeof rawOption.imageHeight === 'number' && Number.isFinite(rawOption.imageHeight)
                  ? Math.floor(rawOption.imageHeight)
                  : null,
            }
          : null);

      return {
        label,
        image,
      };
    })
    .filter((item): item is { label: string; image: PollOptionImageRow | null } => Boolean(item))
    .slice(0, 4);

  if (normalizedOptions.length < 2) {
    return 'INVALID_OPTION_COUNT';
  }

  const hasAnyImage = normalizedOptions.some((option) => option.image);
  const hasMissingImage = normalizedOptions.some((option) => !option.image);

  if (hasAnyImage && hasMissingImage) {
    return 'INVALID_OPTION_IMAGE';
  }

  const options = normalizedOptions.map((option, index) => ({
    id: index + 1,
    label: option.label,
    image: option.image,
  }));

  return {
    question,
    creator_id: creatorId,
    anonymity,
    endType,
    endsAt: endDate.toISOString(),
    options,
  } satisfies PollRow;
}

function extractYoutubeId(value: string) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '';
  }

  const patterns = [
    /(?:youtube\.com\/watch\?v=)([A-Za-z0-9_-]{11})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const matchedValue = normalizedValue.match(pattern);

    if (matchedValue?.[1]) {
      return matchedValue[1];
    }
  }

  return '';
}

function isValidDateValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function buildFeedSubject(value: string) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '';
  }

  return normalizedValue.length > 100 ? normalizedValue.slice(0, 100) : normalizedValue;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { boardName } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    const requestBody = (await request.json()) as RequestBody;

    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const action = requestBody.action === 'draft' ? 'draft' : 'publish';
    const subject = normalizeText(requestBody.subject);
    const summary = normalizeText(requestBody.summary);
    const contentHtml = normalizeText(requestBody.contentHtml);
    const contentMarkdown = normalizeText(requestBody.contentMarkdown);
    const contentSimple = normalizeText(requestBody.contentSimple);
    const thumbnailImage = normalizeText(requestBody.thumbnailImage);
    const youtubeUrl = normalizeText(requestBody.youtubeUrl);
    const youtubeCreatedAt = normalizeText(requestBody.youtubeCreatedAt);
    const youtubeId = extractYoutubeId(youtubeUrl);
    const seriesKey = normalizeText(requestBody.seriesKey).toLowerCase();
    const prefixId = normalizeText(requestBody.prefixId);
    const hashtags = normalizeHashtags(requestBody.hashtags);
    const images = normalizeImages(requestBody.images);
    const requestedIsComment = typeof requestBody.isComment === 'boolean' ? requestBody.isComment : true;
    const isPin = requestBody.isPin === true;
    const thumbnailWidth =
      typeof requestBody.thumbnailWidth === 'number' && Number.isFinite(requestBody.thumbnailWidth)
        ? Math.floor(requestBody.thumbnailWidth)
        : null;
    const thumbnailHeight =
      typeof requestBody.thumbnailHeight === 'number' && Number.isFinite(requestBody.thumbnailHeight)
        ? Math.floor(requestBody.thumbnailHeight)
        : null;

    const categoryKeys = Array.isArray(requestBody.categories)
      ? Array.from(
          new Set(
            requestBody.categories
              .map((value) => normalizeText(value).toLowerCase())
              .filter((value) => value && isValidCategoryKey(value)),
          ),
        )
      : [];

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (seriesKey && !isValidSeriesKey(seriesKey)) {
      return Response.json({ error: '연재 식별자가 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_type, visibility_type, is_shutdown')
      .eq('site_key', siteName)
      .maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const rhizomeData = rhizome.data;

    const session = await verifySession({
      siteId: rhizomeData.id,
    });

    if (!session.authUserId || (session.case !== 'staff' && session.case !== 'member')) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const poll = normalizePoll(requestBody.poll, session.authUserId);

    if (poll === 'INVALID_ANONYMITY') {
      return Response.json({ error: '투표 방식을 선택해주세요.' }, { status: 400 });
    }

    if (poll === 'INVALID_END_TYPE') {
      return Response.json({ error: '투표 종료 방식을 선택해주세요.' }, { status: 400 });
    }

    if (poll === 'INVALID_END_AT') {
      return Response.json({ error: '투표 종료 시간은 최소 1분 뒤로 설정해주세요.' }, { status: 400 });
    }

    if (poll === 'INVALID_OPTION_COUNT') {
      return Response.json({ error: '투표 선택지는 2개 이상 입력해야 합니다.' }, { status: 400 });
    }

    if (poll === 'INVALID_OPTION_IMAGE') {
      return Response.json(
        { error: '썸네일 이미지 사용시 항목에 맞는 이미지는 필수 등록 사항입니다.' },
        { status: 400 },
      );
    }

    const board = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_type, site_id, post_type')
      .eq('site_id', rhizomeData.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (board.data.board_type === 'page') {
      return Response.json({ error: '페이지 게시판에는 글을 작성할 수 없습니다.' }, { status: 403 });
    }

    let resolvedIsComment = requestedIsComment;

    if (rhizomeData.site_type === 'blog') {
      const blog = await supabaseAdmin
        .from('blogs')
        .select('comment_provider')
        .eq('site_id', rhizomeData.id)
        .maybeSingle();

      if (blog.error || !blog.data) {
        return Response.json({ error: '댓글 설정을 확인하지 못했습니다.' }, { status: 500 });
      }

      resolvedIsComment = blog.data.comment_provider === 'none' ? false : requestedIsComment;
    }

    let categoryIds: string[] = [];

    if (categoryKeys.length > 0) {
      const categoryResult = await supabaseAdmin
        .from('board_categories')
        .select('id, category_key')
        .eq('site_id', rhizomeData.id)
        .eq('board_id', board.data.id)
        .in('category_key', categoryKeys);

      if (categoryResult.error) {
        return Response.json({ error: '카테고리 정보를 확인하지 못했습니다.' }, { status: 500 });
      }

      if ((categoryResult.data ?? []).length !== categoryKeys.length) {
        return Response.json({ error: '일부 카테고리를 찾을 수 없습니다.' }, { status: 404 });
      }

      const categoryMap = new Map(
        (categoryResult.data ?? []).map((category) => [category.category_key as string, category.id as string]),
      );

      categoryIds = categoryKeys.map((categoryKey) => categoryMap.get(categoryKey) as string);
    }

    let seriesId: string | null = null;

    if (seriesKey) {
      if (board.data.post_type !== 'series') {
        return Response.json({ error: '연재형 게시판에서만 연재를 선택할 수 있습니다.' }, { status: 400 });
      }

      const seriesResult = await supabaseAdmin
        .from('board_series')
        .select('id, is_completed, user_id')
        .eq('site_id', rhizomeData.id)
        .eq('board_id', board.data.id)
        .eq('series_key', seriesKey)
        .maybeSingle();

      if (seriesResult.error || !seriesResult.data) {
        return Response.json({ error: '연재를 찾을 수 없습니다.' }, { status: 404 });
      }

      if (seriesResult.data.is_completed) {
        return Response.json({ error: '완결된 연재는 선택할 수 없습니다.' }, { status: 400 });
      }

      if (seriesResult.data.user_id && seriesResult.data.user_id !== session.authUserId) {
        return Response.json({ error: '해당 연재를 선택할 권한이 없습니다.' }, { status: 403 });
      }

      seriesId = seriesResult.data.id;
    }

    let resolvedPrefixId: string | null = null;

    if (prefixId) {
      if (board.data.post_type !== 'prefix') {
        return Response.json({ error: '말머리형 게시판에서만 말머리를 선택할 수 있습니다.' }, { status: 400 });
      }

      const prefixResult = await supabaseAdmin
        .from('board_prefixes')
        .select('id')
        .eq('site_id', rhizomeData.id)
        .eq('board_id', board.data.id)
        .eq('id', prefixId)
        .maybeSingle();

      if (prefixResult.error || !prefixResult.data) {
        return Response.json({ error: '말머리를 찾을 수 없습니다.' }, { status: 404 });
      }

      resolvedPrefixId = prefixResult.data.id;
    }

    let finalSubject = subject;
    let finalSummary = summary || null;
    let finalContentHtml = contentHtml || null;
    let finalContentMarkdown = contentMarkdown || null;
    let finalContentSimple = contentSimple || null;
    let finalThumbnailImage = thumbnailImage || null;
    let finalThumbnailWidth = thumbnailWidth;
    let finalThumbnailHeight = thumbnailHeight;
    let finalYoutubeUrl = youtubeUrl || null;
    let finalYoutubeId = youtubeId || null;
    let finalYoutubeCreatedAt = youtubeCreatedAt || null;
    let finalImages = images.length > 0 ? images : null;
    let finalPoll = poll && typeof poll === 'object' ? poll : null;

    if (board.data.board_type === 'basic') {
      finalSummary = null;
      finalContentSimple = null;
      finalYoutubeUrl = null;
      finalYoutubeId = null;
      finalYoutubeCreatedAt = null;
      finalImages = null;

      if (action === 'publish') {
        if (!finalSubject) {
          return Response.json({ error: '제목을 입력해주세요.' }, { status: 400 });
        }

        if (!finalContentHtml || !finalContentMarkdown) {
          return Response.json({ error: '내용을 입력해주세요.' }, { status: 400 });
        }
      }
    }

    if (board.data.board_type === 'gallery') {
      finalYoutubeUrl = null;
      finalYoutubeId = null;
      finalYoutubeCreatedAt = null;
      finalPoll = null;
      finalContentSimple = null;

      if (action === 'publish') {
        if (!finalSubject) {
          return Response.json({ error: '제목을 입력해주세요.' }, { status: 400 });
        }

        if (!finalImages || finalImages.length === 0) {
          return Response.json({ error: '갤러리 이미지를 하나 이상 등록해주세요.' }, { status: 400 });
        }
      }
    }

    if (board.data.board_type === 'youtube') {
      finalContentHtml = null;
      finalContentMarkdown = null;
      finalContentSimple = null;
      finalImages = null;
      finalPoll = null;

      if (action === 'publish') {
        if (!finalSubject) {
          return Response.json({ error: '제목을 입력해주세요.' }, { status: 400 });
        }

        if (!finalSummary) {
          return Response.json({ error: '간단 설명을 입력해주세요.' }, { status: 400 });
        }

        if (!finalYoutubeUrl) {
          return Response.json({ error: '유튜브 영상 주소를 입력해주세요.' }, { status: 400 });
        }

        if (!finalYoutubeId) {
          return Response.json({ error: '유튜브 영상 주소가 올바르지 않습니다.' }, { status: 400 });
        }

        if (!finalYoutubeCreatedAt || !isValidDateValue(finalYoutubeCreatedAt)) {
          return Response.json({ error: '유튜브 업로드 날짜가 올바르지 않습니다.' }, { status: 400 });
        }
      }
    }

    if (board.data.board_type === 'feed') {
      finalSummary = null;
      finalThumbnailImage = null;
      finalThumbnailWidth = null;
      finalThumbnailHeight = null;
      finalContentHtml = null;
      finalContentMarkdown = null;
      finalYoutubeUrl = null;
      finalYoutubeId = null;
      finalYoutubeCreatedAt = null;
      finalPoll = null;
      finalSubject = buildFeedSubject(finalContentSimple ?? '');

      if (action === 'publish') {
        if (!finalContentSimple) {
          return Response.json({ error: '내용을 입력해주세요.' }, { status: 400 });
        }

        if (!finalSubject) {
          return Response.json({ error: '내용을 입력해주세요.' }, { status: 400 });
        }
      }
    }

    const lastPost = await supabaseAdmin
      .from('posts')
      .select('idx, slug')
      .eq('board_id', board.data.id)
      .order('idx', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastPost.error) {
      return Response.json({ error: '글 작성에 실패했습니다.' }, { status: 500 });
    }

    const nextIdx = typeof lastPost.data?.idx === 'number' ? Number(lastPost.data.idx) + 1 : 1;
    const nextSlug = typeof lastPost.data?.slug === 'number' ? Number(lastPost.data.slug) + 1 : Date.now();
    const nowIsoString = new Date().toISOString();

    const insertPost = await supabaseAdmin
      .from('posts')
      .insert({
        slug: nextSlug,
        subject: finalSubject || null,
        summary: finalSummary,
        content_html: finalContentHtml,
        content_markdown: finalContentMarkdown,
        content_simple: finalContentSimple,
        thumbnail_image: finalThumbnailImage,
        thumbnail_width: finalThumbnailWidth,
        thumbnail_height: finalThumbnailHeight,
        youtube_url: finalYoutubeUrl,
        youtube_id: finalYoutubeId,
        youtube_created_at: finalYoutubeCreatedAt,
        images: finalImages,
        poll: finalPoll,
        hashtags,
        idx: nextIdx,
        user_id: session.authUserId,
        site_id: rhizomeData.id,
        board_id: board.data.id,
        is_closed: false,
        categories: categoryIds,
        series_id: seriesId,
        prefix_id: resolvedPrefixId,
        published_status: action === 'draft' ? 'draft' : 'published',
        published_at: action === 'publish' ? nowIsoString : null,
        is_comment: resolvedIsComment,
        post_count: 1,
        is_pin: isPin,
      })
      .select('id, slug')
      .maybeSingle();

    if (insertPost.error || !insertPost.data) {
      return Response.json({ error: '글 작성에 실패했습니다.' }, { status: 500 });
    }

    if (seriesId && action === 'publish') {
      await supabaseAdmin
        .from('board_series')
        .update({
          last_published_at: nowIsoString,
        })
        .eq('id', seriesId);
    }

    return Response.json({
      ok: true,
      slug: String(insertPost.data.slug),
      contentId: insertPost.data.id,
      publishedStatus: action === 'draft' ? 'draft' : 'published',
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '글 작성에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '글 작성에 실패했습니다.' }, { status: 500 });
  }
}
