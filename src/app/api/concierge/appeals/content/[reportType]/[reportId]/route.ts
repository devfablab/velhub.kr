import { normalizeEditorHtml } from '@/lib/editor/normalizeEditorContent';
import { getReportAppealCategory } from '@/lib/reports/appeals';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type ContentRouteContext = {
  params: Promise<{ reportType: string; reportId: string }>;
};

type ReportRow = {
  id: string;
  target_type: 'post' | 'comment';
  post_id: string | null;
  comment_id: string | null;
  legal_type?: string | null;
  reason_type?: string | null;
};

type AppealRow = {
  id: string;
  admin_status: string;
  appellant_status: string;
  content_request: string | null;
  edit_completed_at: string | null;
};

type PostRow = {
  id: string;
  site_id: string;
  board_id: string;
  slug: string | number;
  user_id: string;
  subject: string | null;
  summary: string | null;
  content_html: string | null;
  content_markdown: string | null;
  content_simple: string | null;
  thumbnail_image: string | null;
  youtube_url: string | null;
  youtube_created_at: string | null;
  images: unknown;
  poll: unknown;
  updated_at: string | null;
  exp_at: string | null;
};

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  content: string | null;
  updated_at: string | null;
  exp_at: string | null;
};

type UpdateBody = {
  subject?: string | null;
  summary?: string | null;
  contentHtml?: string | null;
  contentMarkdown?: string | null;
  contentSimple?: string | null;
  youtubeUrl?: string | null;
  youtubeCreatedAt?: string | null;
  thumbnailImage?: string | null;
  images?: unknown;
  poll?: unknown;
  commentContent?: string | null;
};

type PollOptionImage = {
  path: string;
  url: string;
  width: number | null;
  height: number | null;
};

type PollOption = {
  id: number;
  label: string;
  image: PollOptionImage | null;
};

type PollData = {
  question: string;
  creator_id: string;
  anonymity: 'anonymous' | 'named';
  endType: 'absolute' | 'relative';
  endsAt: string;
  options: PollOption[];
};

const reportTableByType = {
  legal: 'report_legals',
  rights: 'report_rights',
} as const;

function normalizeUnknownText(value: unknown) {
  return typeof value === 'string' ? normalizeText(value) : '';
}

async function loadContext(reportType: 'legal' | 'rights', reportId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const reportColumns =
    reportType === 'legal'
      ? 'id, target_type, post_id, comment_id, legal_type'
      : 'id, target_type, post_id, comment_id, reason_type';
  const reportResult = await supabaseAdmin
    .from(reportTableByType[reportType])
    .select(reportColumns)
    .eq('id', reportId)
    .maybeSingle();

  if (reportResult.error || !reportResult.data) {
    throw new Error('신고 내역을 찾을 수 없습니다.');
  }

  const report = reportResult.data as unknown as ReportRow;
  const category = getReportAppealCategory({
    reportType,
    legalType: report.legal_type,
    reasonType: report.reason_type,
  });

  if (!category || (report.target_type !== 'post' && report.target_type !== 'comment')) {
    throw new Error('소명 대상이 아닌 신고입니다.');
  }

  const appealResult = await supabaseAdmin
    .from('report_appeals')
    .select('id, admin_status, appellant_status, content_request, edit_completed_at')
    .eq('report_type', reportType)
    .eq('report_id', report.id)
    .maybeSingle();

  if (appealResult.error) {
    throw new Error('소명 정보를 불러오지 못했습니다.');
  }

  let comment: CommentRow | null = null;
  let postId = report.post_id;

  if (report.target_type === 'comment' && report.comment_id) {
    const commentResult = await supabaseAdmin
      .from('post_comments')
      .select('id, post_id, user_id, content, updated_at, exp_at')
      .eq('id', report.comment_id)
      .maybeSingle();

    if (commentResult.error || !commentResult.data) {
      throw new Error('신고 대상 댓글을 찾을 수 없습니다.');
    }

    comment = commentResult.data as CommentRow;
    postId = comment.post_id;
  }

  if (!postId) {
    throw new Error('신고 대상 게시물을 찾을 수 없습니다.');
  }

  const postResult = await supabaseAdmin
    .from('posts')
    .select(
      'id, site_id, board_id, slug, user_id, subject, summary, content_html, content_markdown, content_simple, thumbnail_image, youtube_url, youtube_created_at, images, poll, updated_at, exp_at',
    )
    .eq('id', postId)
    .maybeSingle();

  if (postResult.error || !postResult.data) {
    throw new Error('신고 대상 게시물을 찾을 수 없습니다.');
  }

  const post = postResult.data as PostRow;
  const [siteResult, boardResult] = await Promise.all([
    supabaseAdmin.from('rhizomes').select('site_key, site_label').eq('id', post.site_id).maybeSingle(),
    supabaseAdmin
      .from('boards')
      .select('board_key, board_label, board_type, markdown_status')
      .eq('id', post.board_id)
      .maybeSingle(),
  ]);

  if (siteResult.error || !siteResult.data || boardResult.error || !boardResult.data) {
    throw new Error('사이트 또는 게시판 정보를 불러오지 못했습니다.');
  }

  return {
    report,
    appeal: (appealResult.data as AppealRow | null) ?? null,
    post,
    comment,
    site: siteResult.data,
    board: boardResult.data,
  };
}

function canEdit(appeal: AppealRow | null) {
  return Boolean(
    appeal &&
      appeal.content_request === 'edit_and_review' &&
      appeal.appellant_status === 'opinion_submitted' &&
      !appeal.edit_completed_at,
  );
}

function getImageRows(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
}

function getPublicPostImageUrl(path: unknown) {
  const normalizedPath = normalizeUnknownText(path);

  if (!normalizedPath) {
    return '';
  }

  return getSupabaseAdmin().storage.from('post').getPublicUrl(normalizedPath).data.publicUrl ?? '';
}

function normalizePoll(value: unknown): PollData | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const rawPoll = value as Record<string, unknown>;
  const question = normalizeUnknownText(rawPoll.question);
  const creatorId = normalizeUnknownText(rawPoll.creator_id);
  const anonymity = rawPoll.anonymity === 'named' ? 'named' : 'anonymous';
  const endType = rawPoll.endType === 'relative' ? 'relative' : rawPoll.endType === 'absolute' ? 'absolute' : null;
  const endsAt = normalizeUnknownText(rawPoll.endsAt);
  const rawOptions = Array.isArray(rawPoll.options) ? rawPoll.options : [];
  const options = rawOptions.flatMap((value, index): PollOption[] => {
    if (!value || typeof value !== 'object') {
      return [];
    }

    const rawOption = value as Record<string, unknown>;
    const label = normalizeUnknownText(rawOption.label);

    if (!label) {
      return [];
    }

    let image: PollOptionImage | null = null;

    if (rawOption.image && typeof rawOption.image === 'object') {
      const rawImage = rawOption.image as Record<string, unknown>;
      const path = normalizeUnknownText(rawImage.path);

      if (path) {
        image = {
          path,
          url: normalizeUnknownText(rawImage.url) || getPublicPostImageUrl(path),
          width: typeof rawImage.width === 'number' && Number.isFinite(rawImage.width) ? rawImage.width : null,
          height: typeof rawImage.height === 'number' && Number.isFinite(rawImage.height) ? rawImage.height : null,
        };
      }
    }

    return [
      {
        id: typeof rawOption.id === 'number' && Number.isFinite(rawOption.id) ? rawOption.id : index,
        label,
        image,
      },
    ];
  });

  if (!question || !creatorId || !endType || !endsAt || options.length < 2) {
    return null;
  }

  return {
    question,
    creator_id: creatorId,
    anonymity,
    endType,
    endsAt,
    options,
  };
}

function normalizePollUpdate(currentPoll: PollData | null, value: unknown) {
  if (!currentPoll || !value || typeof value !== 'object') {
    return currentPoll;
  }

  const rawPoll = value as Record<string, unknown>;
  const question = normalizeUnknownText(rawPoll.question);
  const rawOptions = Array.isArray(rawPoll.options) ? rawPoll.options : [];

  if (!question || rawOptions.length !== currentPoll.options.length) {
    throw new Error('투표 내용을 확인해 주세요.');
  }

  const options = currentPoll.options.map((currentOption, index) => {
    const rawOption = rawOptions[index];

    if (!rawOption || typeof rawOption !== 'object') {
      throw new Error('투표 선택지 내용을 확인해 주세요.');
    }

    const option = rawOption as Record<string, unknown>;
    const label = normalizeUnknownText(option.label);

    if (!label) {
      throw new Error('투표 선택지 내용을 입력해 주세요.');
    }

    const submittedImage =
      option.image && typeof option.image === 'object' ? (option.image as Record<string, unknown>) : null;
    const submittedImagePath = normalizeUnknownText(submittedImage?.path);
    const image =
      currentOption.image && submittedImagePath === currentOption.image.path ? currentOption.image : null;

    return {
      ...currentOption,
      label,
      image,
    };
  });

  return {
    ...currentPoll,
    question,
    options,
  };
}

export async function GET(_request: Request, context: ContentRouteContext) {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { reportType: reportTypeParam, reportId: reportIdParam } = await context.params;
    const reportType = normalizeText(reportTypeParam);
    const reportId = normalizeText(reportIdParam);

    if ((reportType !== 'legal' && reportType !== 'rights') || !reportId) {
      return Response.json({ error: '신고 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    const result = await loadContext(reportType, reportId);
    const authorUserId = result.comment?.user_id ?? result.post.user_id;
    const isAuthor = authorUserId === session.authUserId;

    if (!isAuthor && session.case !== 'admin') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    return Response.json({
      targetType: result.report.target_type,
      canEdit: isAuthor && canEdit(result.appeal),
      site: {
        name: result.site.site_key,
        label: result.site.site_label || result.site.site_key,
      },
      board: {
        name: result.board.board_key,
        label: result.board.board_label || result.board.board_key,
        type: result.board.board_type,
        markdownStatus: result.board.markdown_status,
      },
      post: {
        ...result.post,
        thumbnail_image_url: getPublicPostImageUrl(result.post.thumbnail_image),
        poll: normalizePoll(result.post.poll),
        images: getImageRows(result.post.images).map((image) => ({
          ...image,
          path: normalizeUnknownText(image.path),
          url: getPublicPostImageUrl(image.path),
        })),
      },
      comment: result.comment,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '콘텐츠를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '콘텐츠를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: ContentRouteContext) {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { reportType: reportTypeParam, reportId: reportIdParam } = await context.params;
    const reportType = normalizeText(reportTypeParam);
    const reportId = normalizeText(reportIdParam);

    if ((reportType !== 'legal' && reportType !== 'rights') || !reportId) {
      return Response.json({ error: '신고 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    const result = await loadContext(reportType, reportId);
    const authorUserId = result.comment?.user_id ?? result.post.user_id;

    if (authorUserId !== session.authUserId || !canEdit(result.appeal)) {
      return Response.json({ error: '현재 콘텐츠를 수정할 수 없습니다.' }, { status: 403 });
    }

    const body = (await request.json()) as UpdateBody;
    const now = new Date().toISOString();
    const supabaseAdmin = getSupabaseAdmin();

    if (result.report.target_type === 'comment' && result.comment) {
      const content = normalizeText(body.commentContent);

      if (!content) {
        return Response.json({ error: '댓글 내용을 입력해 주세요.' }, { status: 400 });
      }

      const updateResult = await supabaseAdmin
        .from('post_comments')
        .update({ content, updated_at: now })
        .eq('id', result.comment.id)
        .eq('user_id', session.authUserId)
        .select('id')
        .maybeSingle();

      if (updateResult.error || !updateResult.data) {
        return Response.json({ error: '댓글을 수정하지 못했습니다.' }, { status: 500 });
      }

      return Response.json({ ok: true });
    }

    const boardType = normalizeText(result.board.board_type);
    const subject = boardType === 'feed' ? null : normalizeText(body.subject);

    if (boardType !== 'feed' && !subject) {
      return Response.json({ error: '제목을 입력해 주세요.' }, { status: 400 });
    }

    const existingImages = getImageRows(result.post.images);
    const existingImagePaths = new Set(existingImages.map((image) => normalizeUnknownText(image.path)).filter(Boolean));
    const requestedImages = getImageRows(body.images);
    const images = requestedImages.filter((image) => existingImagePaths.has(normalizeUnknownText(image.path)));
    const thumbnailImage = normalizeText(body.thumbnailImage);
    const poll = normalizePollUpdate(normalizePoll(result.post.poll), body.poll);
    const updateResult = await supabaseAdmin
      .from('posts')
      .update({
        subject,
        summary: boardType === 'gallery' || boardType === 'youtube' ? normalizeText(body.summary) || null : null,
        content_html:
          boardType === 'basic' || boardType === 'gallery'
            ? normalizeEditorHtml(normalizeText(body.contentHtml))
            : null,
        content_markdown:
          boardType === 'basic' || boardType === 'gallery' ? normalizeText(body.contentMarkdown) || null : null,
        content_simple: boardType === 'feed' ? normalizeText(body.contentSimple) || null : null,
        youtube_url: boardType === 'youtube' ? normalizeText(body.youtubeUrl) || null : null,
        youtube_created_at: boardType === 'youtube' ? normalizeText(body.youtubeCreatedAt) || null : null,
        thumbnail_image: thumbnailImage && thumbnailImage === result.post.thumbnail_image ? thumbnailImage : null,
        images: boardType === 'gallery' || boardType === 'feed' ? images : [],
        poll: boardType === 'basic' ? poll : null,
        edited_at: now,
        updated_at: now,
      })
      .eq('id', result.post.id)
      .eq('user_id', session.authUserId)
      .select('id')
      .maybeSingle();

    if (updateResult.error || !updateResult.data) {
      return Response.json({ error: '게시물을 수정하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '콘텐츠를 수정하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '콘텐츠를 수정하지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(_request: Request, context: ContentRouteContext) {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { reportType: reportTypeParam, reportId: reportIdParam } = await context.params;
    const reportType = normalizeText(reportTypeParam);
    const reportId = normalizeText(reportIdParam);

    if ((reportType !== 'legal' && reportType !== 'rights') || !reportId) {
      return Response.json({ error: '신고 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    const result = await loadContext(reportType, reportId);
    const authorUserId = result.comment?.user_id ?? result.post.user_id;

    if (authorUserId !== session.authUserId || !canEdit(result.appeal) || !result.appeal) {
      return Response.json({ error: '수정 확인을 요청할 수 없습니다.' }, { status: 403 });
    }

    const updatedAt = result.comment?.updated_at ?? result.post.updated_at;
    const expAt = result.comment?.exp_at ?? result.post.exp_at;

    if (!updatedAt || !expAt || new Date(updatedAt).getTime() <= new Date(expAt).getTime()) {
      return Response.json({ error: '콘텐츠를 수정한 뒤 확인을 요청해 주세요.' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const updateResult = await getSupabaseAdmin()
      .from('report_appeals')
      .update({
        admin_status: 'edit_review_requested',
        appellant_status: 'decision_pending',
        edit_completed_at: now,
        updated_at: now,
      })
      .eq('id', result.appeal.id)
      .eq('admin_status', 'opinion_received')
      .eq('appellant_status', 'opinion_submitted')
      .select('id')
      .maybeSingle();

    if (updateResult.error || !updateResult.data) {
      return Response.json({ error: '수정 확인을 요청하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '수정 확인을 요청하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '수정 확인을 요청하지 못했습니다.' }, { status: 500 });
  }
}
