import verifySession from '@/lib/session/verifySession';
import { decrypt } from '@/lib/encryption/decrypt';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import {
  getPostContentText,
  getReportCategoryTitle,
  isReportManageTargetType,
  type ReportHandlingResult,
  type ReportManageTargetType,
  type ReportStatus,
} from '@/lib/reports/manage';
import {
  guidelineReportCategories,
  isGuidelineReportCategory,
  type GuidelineReportCategory,
} from '@/lib/reports/guidelines';
import {
  getStaffMessageStatus,
  type GuidelineAppealSenderType,
} from '@/lib/reports/guidelineAppeals';

type PostImageRow = {
  path?: string | null;
  width?: number | null;
  height?: number | null;
};

type PostImage = {
  path: string;
  url: string;
  width: number | null;
  height: number | null;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
};

type ReportRow = {
  id: string;
  target_type: ReportManageTargetType;
  target_id: string;
  site_id: string;
  board_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  reporter_user_id: string;
  report_category: GuidelineReportCategory;
  status: ReportStatus;
  created_at: string;
  handled_at: string | null;
  handler_user_id: string | null;
  handling_result: ReportHandlingResult | null;
};

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string | null;
  board_type: string | null;
};

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type PostRow = {
  id: string;
  board_id: string;
  user_id: string | null;
  subject: string | null;
  slug: number | string;
  published_at: string | null;
  content_html: string | null;
  content_markdown: string | null;
  content_simple: string | null;
  summary: string | null;
  youtube_url: string | null;
  thumbnail_image: string | null;
  poll: JsonValue;
  images: JsonValue;
  is_closed: boolean;
  closed_message: string | null;
};

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string | null;
  content: string | null;
  created_at: string;
  is_deleted: boolean;
  deleted_message: string | null;
};

type StigmaRow = {
  id: string;
  user_id: string;
  user_name: string | null;
};

type RhizomeStigmaRow = {
  user_id: string;
  nickname: string | null;
};

function getPublicPostImageUrl(path: string | null | undefined) {
  const normalizedPath = normalizeText(path);

  if (!normalizedPath) {
    return '';
  }

  const supabaseAdmin = getSupabaseAdmin();
  const bucket = normalizedPath.includes('/') ? 'post' : 'og-image';
  const publicUrl = supabaseAdmin.storage.from(bucket).getPublicUrl(normalizedPath);

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
    .filter((image): image is PostImage => Boolean(image));
}

function decryptValue(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '';
  }

  try {
    return decrypt(normalizedValue);
  } catch {
    return '';
  }
}

async function createUserNameMap(siteId: string, userIds: string[]) {
  const normalizedUserIds = Array.from(new Set(userIds.map((userId) => normalizeText(userId)).filter(Boolean)));

  if (normalizedUserIds.length === 0) {
    return new Map<string, string>();
  }

  const supabaseAdmin = getSupabaseAdmin();

  const stigmasByAuthResult = await supabaseAdmin
    .from('stigmas')
    .select('id, user_id, user_name')
    .in('user_id', normalizedUserIds);

  if (stigmasByAuthResult.error) {
    throw new Error('사용자 정보를 불러오지 못했습니다.');
  }

  const foundAuthIds = new Set((stigmasByAuthResult.data ?? []).map((stigma) => stigma.user_id as string));
  const missingIds = normalizedUserIds.filter((userId) => !foundAuthIds.has(userId));

  const stigmasByIdResult = missingIds.length
    ? await supabaseAdmin.from('stigmas').select('id, user_id, user_name').in('id', missingIds)
    : { data: [], error: null };

  if (stigmasByIdResult.error) {
    throw new Error('사용자 정보를 불러오지 못했습니다.');
  }

  const stigmas = [
    ...((stigmasByAuthResult.data ?? []) as StigmaRow[]),
    ...((stigmasByIdResult.data ?? []) as StigmaRow[]),
  ];

  const stigmaIds = Array.from(new Set(stigmas.map((stigma) => stigma.id)));
  const rhizomeStigmasResult = stigmaIds.length
    ? await supabaseAdmin
        .from('rhizome_stigmas')
        .select('user_id, nickname')
        .eq('site_id', siteId)
        .in('user_id', stigmaIds)
    : { data: [], error: null };

  if (rhizomeStigmasResult.error) {
    throw new Error('사용자 정보를 불러오지 못했습니다.');
  }

  const nicknameByStigmaId = new Map(
    ((rhizomeStigmasResult.data ?? []) as RhizomeStigmaRow[]).map((rhizomeStigma) => [
      rhizomeStigma.user_id,
      normalizeText(rhizomeStigma.nickname),
    ]),
  );

  const userNameMap = new Map<string, string>();

  stigmas.forEach((stigma) => {
    const name = nicknameByStigmaId.get(stigma.id) || decryptValue(stigma.user_name) || '사용자';
    userNameMap.set(stigma.user_id, name);
    userNameMap.set(stigma.id, name);
  });

  return userNameMap;
}

function getHistoryMode(value: string | null) {
  return value === 'past' ? 'past' : 'current';
}

function getStatusFilter(targetType: ReportManageTargetType, mode: 'current' | 'past') {
  if (mode === 'past') {
    return ['dismissed', 'completed'];
  }

  if (targetType === 'board') {
    return ['received', 'reviewing'];
  }

  return ['received', 'reviewing', 'completed'];
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();
    const targetType = normalizeText(requestUrl.searchParams.get('targetType'));
    const mode = getHistoryMode(requestUrl.searchParams.get('mode'));

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!isReportManageTargetType(targetType)) {
      return Response.json({ error: '신고 대상이 올바르지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const siteResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_label')
      .eq('site_key', siteName)
      .maybeSingle();

    if (siteResult.error || !siteResult.data) {
      return Response.json({ error: '사이트 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const site = siteResult.data as SiteRow;
    const session = await verifySession({ siteId: site.id });

    if (session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const reportsResult = await supabaseAdmin
      .from('report_guidelines')
      .select(
        [
          'id',
          'target_type',
          'target_id',
          'site_id',
          'board_id',
          'post_id',
          'comment_id',
          'reporter_user_id',
          'report_category',
          'status',
          'created_at',
          'handled_at',
          'handler_user_id',
          'handling_result',
        ].join(', '),
      )
      .eq('site_id', site.id)
      .eq('target_type', targetType)
      .in('report_category', [...guidelineReportCategories])
      .in('status', getStatusFilter(targetType, mode))
      .order('created_at', { ascending: false });

    if (reportsResult.error) {
      console.error(reportsResult.error);
      return Response.json({ error: '신고 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const reports = ((reportsResult.data ?? []) as unknown as ReportRow[]).filter((report) => {
      if (report.target_type === 'board' || report.status !== 'completed') {
        return true;
      }

      return mode === 'past' ? Boolean(report.handling_result) : !report.handling_result;
    });
    const reportIds = reports.map((report) => report.id);
    const messagesResult = reportIds.length
      ? await supabaseAdmin
          .from('report_guideline_messages')
          .select('id, report_id, sender_type, created_at')
          .in('report_id', reportIds)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
      : { data: [], error: null };

    if (messagesResult.error) {
      console.error(messagesResult.error);
      return Response.json({ error: '소명 메시지 상태를 불러오지 못했습니다.' }, { status: 500 });
    }

    const lastSenderByReport = new Map<string, GuidelineAppealSenderType>();

    for (const message of (messagesResult.data ?? []) as {
      report_id: string;
      sender_type: GuidelineAppealSenderType;
    }[]) {
      lastSenderByReport.set(message.report_id, message.sender_type);
    }

    const boardIds = Array.from(new Set(reports.map((report) => report.board_id).filter(Boolean))) as string[];
    const postIds = Array.from(new Set(reports.map((report) => report.post_id).filter(Boolean))) as string[];
    const commentIds = Array.from(new Set(reports.map((report) => report.comment_id).filter(Boolean))) as string[];

    const boardsResult = boardIds.length
      ? await supabaseAdmin.from('boards').select('id, board_key, board_label, board_type').in('id', boardIds)
      : { data: [], error: null };

    if (boardsResult.error) {
      console.error(boardsResult.error);
      return Response.json({ error: '게시판 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const commentsResult =
      targetType === 'comment' && commentIds.length
        ? await supabaseAdmin
            .from('post_comments')
            .select('id, post_id, user_id, content, created_at, is_deleted, deleted_message')
            .in('id', commentIds)
        : { data: [], error: null };

    if (commentsResult.error) {
      console.error(commentsResult.error);
      return Response.json({ error: '댓글 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const comments = (commentsResult.data ?? []) as CommentRow[];
    const commentPostIds = comments.map((comment) => comment.post_id).filter(Boolean);
    const allPostIds = Array.from(new Set([...postIds, ...commentPostIds]));

    const postsResult = allPostIds.length
      ? await supabaseAdmin
          .from('posts')
          .select(
            [
              'id',
              'board_id',
              'user_id',
              'subject',
              'slug',
              'published_at',
              'content_html',
              'content_markdown',
              'content_simple',
              'summary',
              'youtube_url',
              'thumbnail_image',
              'poll',
              'images',
              'is_closed',
              'closed_message',
            ].join(', '),
          )
          .in('id', allPostIds)
      : { data: [], error: null };

    if (postsResult.error) {
      console.error(postsResult.error);
      return Response.json({ error: '게시물 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const boards = (boardsResult.data ?? []) as BoardRow[];
    const posts = (postsResult.data ?? []) as PostRow[];

    const boardById = new Map(boards.map((board) => [board.id, board]));
    const postById = new Map(posts.map((post) => [post.id, post]));
    const commentById = new Map(comments.map((comment) => [comment.id, comment]));

    const userIds = reports.flatMap((report) => [
      report.reporter_user_id,
      report.handler_user_id ?? '',
      postById.get(report.post_id ?? '')?.user_id ?? '',
      commentById.get(report.comment_id ?? '')?.user_id ?? '',
    ]);

    const userNameMap = await createUserNameMap(site.id, userIds);

    const items = reports.map((report) => {
      const board = report.board_id ? boardById.get(report.board_id) : null;
      const post = report.post_id ? postById.get(report.post_id) : null;
      const comment = report.comment_id ? commentById.get(report.comment_id) : null;
      const commentPost = comment?.post_id ? postById.get(comment.post_id) : null;
      const targetPost = post ?? commentPost ?? null;
      const targetBoard = board ?? (targetPost?.board_id ? boardById.get(targetPost.board_id) : null) ?? null;
      const boardType = targetBoard?.board_type ?? null;
      const isGuidelineCategory = guidelineReportCategories.includes(
        report.report_category as (typeof guidelineReportCategories)[number],
      );
      const hasAppealMessages = lastSenderByReport.has(report.id);
      const isAppealAvailable =
        report.status === 'completed' && isGuidelineCategory && report.target_type === 'post'
          ? targetPost?.is_closed === true && Boolean(normalizeText(targetPost.closed_message))
          : report.status === 'completed' && isGuidelineCategory && report.target_type === 'comment'
            ? comment?.is_deleted === true && Boolean(normalizeText(comment.deleted_message))
            : false;
      const canAppeal = hasAppealMessages || isAppealAvailable;

      return {
        id: report.id,
        targetType: report.target_type,
        status: report.status,
        statusLabel: report.status,
        createdAt: report.created_at,
        handledAt: report.handled_at,
        handlingResult: report.handling_result,
        reporterName: userNameMap.get(report.reporter_user_id) ?? '사용자',
        handlerName: report.handler_user_id ? (userNameMap.get(report.handler_user_id) ?? '사용자') : null,
        reportCategory: report.report_category,
        reportCategoryLabel: isGuidelineReportCategory(report.report_category)
          ? getReportCategoryTitle(report.target_type, report.report_category)
          : report.report_category,
        canAppeal,
        appealMessageStatus: getStaffMessageStatus(lastSenderByReport.get(report.id) ?? null),
        board: targetBoard
          ? {
              id: targetBoard.id,
              name: targetBoard.board_label || targetBoard.board_key,
              key: targetBoard.board_key,
              type: targetBoard.board_type,
              href: `/${site.site_key}/${targetBoard.board_key}`,
            }
          : null,
        post: targetPost
          ? {
              id: targetPost.id,
              title: targetPost.subject ?? '제목 없음',
              slug: String(targetPost.slug),
              href: targetBoard ? `/${site.site_key}/${targetBoard.board_key}/${targetPost.slug}` : '',
              publishedAt: targetPost.published_at,
              authorName: targetPost.user_id ? (userNameMap.get(targetPost.user_id) ?? '사용자') : '사용자',
              content: getPostContentText({
                boardType,
                contentHtml: targetPost.content_html,
                contentMarkdown: targetPost.content_markdown,
                contentSimple: targetPost.content_simple,
                summary: targetPost.summary,
                youtubeUrl: targetPost.youtube_url,
              }),
              thumbnailImage: getPublicPostImageUrl(targetPost.thumbnail_image),
              images: normalizeImages(targetPost.images),
              poll: targetPost.poll,
              isClosed: targetPost.is_closed === true,
            }
          : null,
        comment: comment
          ? {
              id: comment.id,
              content: comment.content ?? '',
              createdAt: comment.created_at,
              authorName: comment.user_id ? (userNameMap.get(comment.user_id) ?? '사용자') : '사용자',
              isDeleted: comment.is_deleted === true,
            }
          : null,
      };
    });

    return Response.json({
      site: {
        id: site.id,
        siteKey: site.site_key,
        siteLabel: site.site_label,
      },
      targetType,
      mode,
      reports: items,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '신고 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '신고 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
