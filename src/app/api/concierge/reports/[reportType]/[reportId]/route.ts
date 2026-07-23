import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isConciergeReportType, type ConciergeReportType } from '@/lib/reports/concierge';
import { isReportStatus, type ReportStatus } from '@/lib/reports/manage';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    reportType: string;
    reportId: string;
  }>;
};

type PatchBody = {
  status?: string | null;
};

type ReportRow = {
  id: string;
  target_type: string | null;
  post_id: string | null;
  comment_id: string | null;
  status: string;
  created_at: string;
};

const reportTableByType: Record<ConciergeReportType, string> = {
  guideline: 'report_guidelines',
  legal: 'report_legals',
  rights: 'report_rights',
};

function isPendingStatus(status: string) {
  return status === 'received' || status === 'reviewing';
}

function getViolationMessage(reportType: ConciergeReportType) {
  if (reportType === 'legal') {
    return '법률 위반';
  }

  return '가이드라인 위반';
}

async function updatePost({
  postId,
  reportType,
  status,
  handlerUserId,
  now,
}: {
  postId: string;
  reportType: ConciergeReportType;
  status: ReportStatus;
  handlerUserId: string;
  now: string;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const updatePayload =
    reportType === 'rights' && status === 'dismissed'
      ? {
          is_closed: false,
          is_locked: false,
          closed_message: '소명됨',
          closed_by: null,
          closed_at: null,
        }
      : {
          is_closed: true,
          is_locked: true,
          closed_message: getViolationMessage(reportType),
          closed_by: handlerUserId,
          closed_at: now,
        };

  const updateResult = await supabaseAdmin
    .from('posts')
    .update(updatePayload)
    .eq('id', postId)
    .select('id')
    .maybeSingle();

  if (updateResult.error || !updateResult.data) {
    console.error('[concierge/reports] post update error', updateResult.error);
    throw new Error(status === 'dismissed' ? '게시물 숨김을 해제하지 못했습니다.' : '게시물을 처리하지 못했습니다.');
  }
}

async function updateComment({
  commentId,
  reportType,
  status,
  handlerUserId,
  now,
}: {
  commentId: string;
  reportType: ConciergeReportType;
  status: ReportStatus;
  handlerUserId: string;
  now: string;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const updatePayload =
    reportType === 'rights' && status === 'dismissed'
      ? {
          is_deleted: false,
          is_locked: false,
          deleted_message: '소명됨',
          deleted_by: null,
          deleted_at: null,
        }
      : {
          is_deleted: true,
          is_locked: true,
          deleted_message: getViolationMessage(reportType),
          deleted_by: handlerUserId,
          deleted_at: now,
        };

  const updateResult = await supabaseAdmin
    .from('post_comments')
    .update(updatePayload)
    .eq('id', commentId)
    .select('id')
    .maybeSingle();

  if (updateResult.error || !updateResult.data) {
    console.error('[concierge/reports] comment update error', updateResult.error);
    throw new Error(status === 'dismissed' ? '댓글 숨김을 해제하지 못했습니다.' : '댓글을 처리하지 못했습니다.');
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await verifySession({ siteId: null });

    if (session.case !== 'admin' || !session.authUserId) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const { reportType: reportTypeParam, reportId: reportIdParam } = await context.params;
    const reportType = normalizeText(reportTypeParam);
    const reportId = normalizeText(reportIdParam);
    const body = (await request.json()) as PatchBody;
    const nextStatus = normalizeText(body.status);

    if (!isConciergeReportType(reportType) || !reportId) {
      return Response.json({ error: '신고 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    if (!isReportStatus(nextStatus) || (nextStatus !== 'dismissed' && nextStatus !== 'completed')) {
      return Response.json({ error: '처리 상태가 올바르지 않습니다.' }, { status: 400 });
    }

    if (reportType === 'rights' && nextStatus === 'completed') {
      return Response.json({ error: '권리침해 신고는 현재 이상 없음 처리만 가능합니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const table = reportTableByType[reportType];
    const reportResult = await supabaseAdmin
      .from(table)
      .select('id, target_type, post_id, comment_id, status, created_at')
      .eq('id', reportId)
      .maybeSingle();

    if (reportResult.error || !reportResult.data) {
      return Response.json({ error: '신고 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    const report = reportResult.data as ReportRow;

    if (!isPendingStatus(report.status)) {
      return Response.json({ error: '이미 처리가 끝난 신고입니다.' }, { status: 409 });
    }

    if (report.target_type !== 'post' && report.target_type !== 'comment') {
      return Response.json({ error: '이 신고는 상태 변경 대상이 아닙니다.' }, { status: 400 });
    }

    const createdAtTime = new Date(report.created_at).getTime();
    const nowTime = Date.now();

    if (
      reportType === 'guideline' &&
      nextStatus === 'completed' &&
      (!Number.isFinite(createdAtTime) || nowTime - createdAtTime < 3 * 24 * 60 * 60 * 1000)
    ) {
      return Response.json({ error: '신고 접수 후 3일이 지나야 직접 제재할 수 있습니다.' }, { status: 400 });
    }

    if (
      reportType === 'rights' &&
      (!Number.isFinite(createdAtTime) || nowTime - createdAtTime >= 30 * 24 * 60 * 60 * 1000)
    ) {
      return Response.json({ error: '30일이 지난 권리침해 신고는 이상 없음 처리할 수 없습니다.' }, { status: 400 });
    }

    const now = new Date(nowTime).toISOString();
    const shouldUpdateContent = nextStatus === 'completed' || reportType === 'rights';

    if (shouldUpdateContent && report.target_type === 'post') {
      if (!report.post_id) {
        return Response.json({ error: '게시물 정보가 없습니다.' }, { status: 400 });
      }

      await updatePost({
        postId: report.post_id,
        reportType,
        status: nextStatus,
        handlerUserId: session.authUserId,
        now,
      });
    }

    if (shouldUpdateContent && report.target_type === 'comment') {
      if (!report.comment_id) {
        return Response.json({ error: '댓글 정보가 없습니다.' }, { status: 400 });
      }

      await updateComment({
        commentId: report.comment_id,
        reportType,
        status: nextStatus,
        handlerUserId: session.authUserId,
        now,
      });
    }

    const updateResult = await supabaseAdmin
      .from(table)
      .update({
        status: 'completed',
        handling_result: nextStatus === 'dismissed' ? 'no_issue' : 'keep_deleted',
        handler_user_id: session.authUserId,
        handled_at: now,
        updated_at: now,
      })
      .eq('id', report.id)
      .in('status', ['received', 'reviewing'])
      .select('id, status, handling_result, handled_at')
      .maybeSingle();

    if (updateResult.error || !updateResult.data) {
      console.error('[concierge/reports] status update error', updateResult.error);
      return Response.json({ error: '신고 처리 상태를 저장하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ ok: true, report: updateResult.data });
  } catch (unknownError) {
    console.error('[concierge/reports] action error', unknownError);

    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '신고를 처리하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '신고를 처리하지 못했습니다.' }, { status: 500 });
  }
}
