import verifySession from '@/lib/session/verifySession';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { reorderSeriesIdx } from '@/lib/board/seriesIdx';
import {
  getReportCategoryTitle,
  isAllowedReportStatus,
  isReportManageTargetType,
  isReportStatus,
  type ReportManageTargetType,
  type ReportStatus,
} from '@/lib/reports/manage';
import { isGuidelineReportCategory, type GuidelineReportCategory } from '@/lib/reports/guidelines';

type RouteContext = {
  params: Promise<{
    reportId: string;
  }>;
};

type PatchRequestBody = {
  siteName?: string | null;
  status?: string | null;
};

type SiteRow = {
  id: string;
};

type ReportRow = {
  id: string;
  target_type: ReportManageTargetType;
  site_id: string;
  board_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  report_category: GuidelineReportCategory;
  status: ReportStatus;
  handling_result: string | null;
};

type PostRow = {
  id: string;
  site_id: string;
  board_id: string;
  is_closed: boolean;
  series_id: string | null;
  published_status: string | null;
};

type CommentRow = {
  id: string;
  site_id: string;
  board_id: string;
  post_id: string;
  is_deleted: boolean;
};

function getClosedMessage(targetType: ReportManageTargetType, reportCategory: GuidelineReportCategory | string) {
  if (isGuidelineReportCategory(reportCategory)) {
    return getReportCategoryTitle(targetType, reportCategory);
  }

  return String(reportCategory);
}

async function closePost({
  post,
  handlerUserId,
  closedMessage,
}: {
  post: PostRow;
  handlerUserId: string;
  closedMessage: string;
}) {
  if (post.is_closed === true) {
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();

  const closeResult = await supabaseAdmin
    .from('posts')
    .update({
      is_closed: true,
      is_locked: true,
      closed_by: handlerUserId,
      closed_at: new Date().toISOString(),
      closed_message: closedMessage,
      series_idx: null,
    })
    .eq('id', post.id);

  if (closeResult.error) {
    console.error(closeResult.error);
    throw new Error('게시물 삭제에 실패했습니다.');
  }

  if (post.series_id && post.published_status === 'published') {
    await reorderSeriesIdx({
      siteId: post.site_id,
      boardId: post.board_id,
      seriesId: post.series_id,
    });
  }
}

async function closeComment({
  comment,
  handlerUserId,
  deletedMessage,
}: {
  comment: CommentRow;
  handlerUserId: string;
  deletedMessage: string;
}) {
  if (comment.is_deleted === true) {
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();

  const closeResult = await supabaseAdmin
    .from('post_comments')
    .update({
      is_deleted: true,
      is_locked: true,
      deleted_by: handlerUserId,
      deleted_at: new Date().toISOString(),
      deleted_message: deletedMessage,
    })
    .eq('id', comment.id);

  if (closeResult.error) {
    console.error(closeResult.error);
    throw new Error('댓글 삭제에 실패했습니다.');
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { reportId } = await context.params;
    const normalizedReportId = normalizeText(reportId);

    if (!normalizedReportId) {
      return Response.json({ error: 'reportId가 유효하지 않습니다.' }, { status: 400 });
    }

    const requestBody = (await request.json()) as PatchRequestBody;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const nextStatus = normalizeText(requestBody.status);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!isReportStatus(nextStatus)) {
      return Response.json({ error: '처리 상태가 올바르지 않습니다.' }, { status: 400 });
    }

    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const siteResult = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

    if (siteResult.error || !siteResult.data) {
      return Response.json({ error: '사이트 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const site = siteResult.data as SiteRow;
    const session = await verifySession({ siteId: site.id });

    if (session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const reportResult = await supabaseAdmin
      .from('report_guidelines')
      .select('id, target_type, site_id, board_id, post_id, comment_id, report_category, status, handling_result')
      .eq('id', normalizedReportId)
      .eq('site_id', site.id)
      .maybeSingle();

    if (reportResult.error || !reportResult.data) {
      return Response.json({ error: '신고 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    const report = reportResult.data as ReportRow;

    if (!isReportManageTargetType(report.target_type)) {
      return Response.json({ error: '처리할 수 없는 신고 대상입니다.' }, { status: 400 });
    }

    if (!isAllowedReportStatus(report.target_type, nextStatus)) {
      return Response.json({ error: '이 신고 대상에 사용할 수 없는 처리 상태입니다.' }, { status: 400 });
    }

    const nowIsoString = new Date().toISOString();

    if (nextStatus === 'completed' && report.target_type === 'post') {
      if (!report.post_id) {
        return Response.json({ error: '게시물 정보가 없습니다.' }, { status: 400 });
      }

      const postResult = await supabaseAdmin
        .from('posts')
        .select('id, site_id, board_id, is_closed, series_id, published_status')
        .eq('id', report.post_id)
        .eq('site_id', site.id)
        .maybeSingle();

      if (postResult.error || !postResult.data) {
        return Response.json({ error: '게시물을 찾을 수 없습니다.' }, { status: 404 });
      }

      await closePost({
        post: postResult.data as PostRow,
        handlerUserId: sessionClaims.userId,
        closedMessage: getClosedMessage(report.target_type, report.report_category),
      });
    }

    if (nextStatus === 'completed' && report.target_type === 'comment') {
      if (!report.comment_id) {
        return Response.json({ error: '댓글 정보가 없습니다.' }, { status: 400 });
      }

      const commentResult = await supabaseAdmin
        .from('post_comments')
        .select('id, site_id, board_id, post_id, is_deleted')
        .eq('id', report.comment_id)
        .eq('site_id', site.id)
        .maybeSingle();

      if (commentResult.error || !commentResult.data) {
        return Response.json({ error: '댓글을 찾을 수 없습니다.' }, { status: 404 });
      }

      await closeComment({
        comment: commentResult.data as CommentRow,
        handlerUserId: sessionClaims.userId,
        deletedMessage: getClosedMessage(report.target_type, report.report_category),
      });
    }

    const storedStatus =
      report.target_type !== 'board' && nextStatus === 'dismissed' ? ('completed' as const) : nextStatus;
    const handlingResult =
      report.target_type !== 'board' && nextStatus === 'dismissed'
        ? ('no_issue' as const)
        : report.target_type !== 'board' && nextStatus === 'completed'
          ? null
          : report.handling_result;
    const updatePayload =
      storedStatus === 'reviewing'
        ? {
            status: storedStatus,
            handling_result: handlingResult,
            updated_at: nowIsoString,
          }
        : {
            status: storedStatus,
            handling_result: handlingResult,
            handler_user_id: sessionClaims.userId,
            handled_at: nowIsoString,
            updated_at: nowIsoString,
          };

    const updateResult = await supabaseAdmin
      .from('report_guidelines')
      .update(updatePayload)
      .eq('id', report.id)
      .eq('site_id', site.id)
      .select('id, status, handling_result, handled_at, handler_user_id')
      .maybeSingle();

    if (updateResult.error || !updateResult.data) {
      console.error(updateResult.error);
      return Response.json({ error: '신고 처리 상태를 저장하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      report: updateResult.data,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '신고 처리 상태를 저장하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '신고 처리 상태를 저장하지 못했습니다.' }, { status: 500 });
  }
}
