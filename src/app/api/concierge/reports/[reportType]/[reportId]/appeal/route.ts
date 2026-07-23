import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  getReportAppealCategory,
  isAppealDeletionReason,
  type ReportAppealCategory,
} from '@/lib/reports/appeals';
import { normalizeText } from '@/lib/utils';
import { NOTIFICATION_TYPE } from '@/lib/notifications/types';

type RouteContext = {
  params: Promise<{
    reportType: string;
    reportId: string;
  }>;
};

type RequestBody = {
  submissionSummary?: string | null;
  deletionReason?: string | null;
  appealRequest?: string | null;
};

type PatchBody = {
  action?: string | null;
};

type ReportRow = {
  id: string;
  target_type: string | null;
  post_id: string | null;
  comment_id: string | null;
  status: string;
  legal_type?: string | null;
  reason_type?: string | null;
  reporter_user_id?: string;
  site_id?: string | null;
  board_id?: string | null;
};

type PostState = {
  id: string;
  is_closed: boolean;
  is_locked: boolean;
  closed_message: string | null;
  closed_by: string | null;
  closed_at: string | null;
};

type CommentState = {
  id: string;
  is_deleted: boolean;
  is_locked: boolean;
  deleted_message: string | null;
  deleted_by: string | null;
  deleted_at: string | null;
};

const reportTableByType = {
  legal: 'report_legals',
  rights: 'report_rights',
} as const;

async function restoreContentState({
  post,
  comment,
}: {
  post: PostState | null;
  comment: CommentState | null;
}) {
  const supabaseAdmin = getSupabaseAdmin();

  if (post) {
    await supabaseAdmin
      .from('posts')
      .update({
        is_closed: post.is_closed,
        is_locked: post.is_locked,
        closed_message: post.closed_message,
        closed_by: post.closed_by,
        closed_at: post.closed_at,
      })
      .eq('id', post.id);
  }

  if (comment) {
    await supabaseAdmin
      .from('post_comments')
      .update({
        is_deleted: comment.is_deleted,
        is_locked: comment.is_locked,
        deleted_message: comment.deleted_message,
        deleted_by: comment.deleted_by,
        deleted_at: comment.deleted_at,
      })
      .eq('id', comment.id);
  }
}

async function loadContentState(report: ReportRow) {
  const supabaseAdmin = getSupabaseAdmin();

  if (report.target_type === 'post' && report.post_id) {
    const result = await supabaseAdmin
      .from('posts')
      .select('id, is_closed, is_locked, closed_message, closed_by, closed_at')
      .eq('id', report.post_id)
      .maybeSingle();

    if (result.error || !result.data) {
      throw new Error('신고 대상 게시물을 찾을 수 없습니다.');
    }

    return { post: result.data as PostState, comment: null };
  }

  if (report.target_type === 'comment' && report.comment_id) {
    const result = await supabaseAdmin
      .from('post_comments')
      .select('id, is_deleted, is_locked, deleted_message, deleted_by, deleted_at')
      .eq('id', report.comment_id)
      .maybeSingle();

    if (result.error || !result.data) {
      throw new Error('신고 대상 댓글을 찾을 수 없습니다.');
    }

    return { post: null, comment: result.data as CommentState };
  }

  throw new Error('소명 요청서를 작성할 수 없는 신고 대상입니다.');
}

async function deleteContent({
  report,
  reportType,
  handlerUserId,
  now,
}: {
  report: ReportRow;
  reportType: 'legal' | 'rights';
  handlerUserId: string;
  now: string;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const violationMessage = reportType === 'legal' ? '법률 위반' : '권리침해 위반';

  if (report.target_type === 'post' && report.post_id) {
    const result = await supabaseAdmin
      .from('posts')
      .update({
        is_closed: true,
        is_locked: true,
        closed_message: violationMessage,
        closed_by: handlerUserId,
        closed_at: now,
      })
      .eq('id', report.post_id)
      .select('id')
      .maybeSingle();

    if (result.error || !result.data) {
      throw new Error('게시물을 삭제 처리하지 못했습니다.');
    }

    return;
  }

  if (report.target_type === 'comment' && report.comment_id) {
    const result = await supabaseAdmin
      .from('post_comments')
      .update({
        is_deleted: true,
        is_locked: true,
        deleted_message: violationMessage,
        deleted_by: handlerUserId,
        deleted_at: now,
      })
      .eq('id', report.comment_id)
      .select('id')
      .maybeSingle();

    if (result.error || !result.data) {
      throw new Error('댓글을 삭제 처리하지 못했습니다.');
    }

    return;
  }

  throw new Error('소명 요청서를 작성할 수 없는 신고 대상입니다.');
}

async function restoreDeletedContent(report: ReportRow) {
  const supabaseAdmin = getSupabaseAdmin();

  if (report.target_type === 'post' && report.post_id) {
    const result = await supabaseAdmin
      .from('posts')
      .update({
        is_closed: false,
        is_locked: false,
        closed_message: '소명됨',
        closed_by: null,
        closed_at: null,
      })
      .eq('id', report.post_id)
      .select('id')
      .maybeSingle();

    if (result.error || !result.data) {
      throw new Error('게시물을 복구하지 못했습니다.');
    }

    return;
  }

  if (report.target_type === 'comment' && report.comment_id) {
    const result = await supabaseAdmin
      .from('post_comments')
      .update({
        is_deleted: false,
        is_locked: false,
        deleted_message: '소명됨',
        deleted_by: null,
        deleted_at: null,
      })
      .eq('id', report.comment_id)
      .select('id')
      .maybeSingle();

    if (result.error || !result.data) {
      throw new Error('댓글을 복구하지 못했습니다.');
    }

    return;
  }

  throw new Error('복구할 신고 대상이 없습니다.');
}

async function sendReporterResultNotification(report: ReportRow) {
  if (!report.reporter_user_id) {
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const notificationResult = await supabaseAdmin.from('notifications').insert({
    user_id: report.reporter_user_id,
    send_user_id: null,
    target_id: null,
    send_site_id: report.site_id ?? null,
    send_board_id: report.board_id ?? null,
    send_series_id: null,
    send_post_id: report.post_id ?? null,
    notification_type: NOTIFICATION_TYPE.REPORT_RESULT,
    is_read: false,
  });

  if (notificationResult.error) {
    console.error('[concierge/reports/appeal] reporter notification error', notificationResult.error);
  }
}

function getCategory(reportType: 'legal' | 'rights', report: ReportRow): ReportAppealCategory | null {
  return getReportAppealCategory({
    reportType,
    legalType: report.legal_type,
    reasonType: report.reason_type,
  });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await verifySession({ siteId: null });

    if (session.case !== 'admin' || !session.authUserId) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const { reportType: reportTypeParam, reportId: reportIdParam } = await context.params;
    const reportType = normalizeText(reportTypeParam);
    const reportId = normalizeText(reportIdParam);

    if ((reportType !== 'legal' && reportType !== 'rights') || !reportId) {
      return Response.json({ error: '신고 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    const body = (await request.json()) as RequestBody;
    const submissionSummary = normalizeText(body.submissionSummary);
    const deletionReason = normalizeText(body.deletionReason);
    const appealRequest = normalizeText(body.appealRequest);

    if (!submissionSummary) {
      return Response.json({ error: '제출 자료 요지를 입력해 주세요.' }, { status: 400 });
    }

    if (!appealRequest) {
      return Response.json({ error: '소명 요청사항을 입력해 주세요.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const reportTable = reportTableByType[reportType];
    const reportColumns =
      reportType === 'legal'
        ? 'id, target_type, post_id, comment_id, status, legal_type'
        : 'id, target_type, post_id, comment_id, status, reason_type';
    const reportResult = await supabaseAdmin
      .from(reportTable)
      .select(reportColumns)
      .eq('id', reportId)
      .maybeSingle();

    if (reportResult.error || !reportResult.data) {
      return Response.json({ error: '신고 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    const report = reportResult.data as unknown as ReportRow;
    const category = getCategory(reportType, report);

    if (!category || (report.target_type !== 'post' && report.target_type !== 'comment')) {
      return Response.json({ error: '소명 요청서를 작성할 수 없는 신고입니다.' }, { status: 400 });
    }

    if (report.status === 'dismissed') {
      return Response.json({ error: '이상 없음으로 처리된 신고입니다.' }, { status: 409 });
    }

    if (!isAppealDeletionReason(category, deletionReason)) {
      return Response.json({ error: '삭제 사유를 선택해 주세요.' }, { status: 400 });
    }

    const existingAppealResult = await supabaseAdmin
      .from('report_appeals')
      .select('id')
      .eq('report_type', reportType)
      .eq('report_id', report.id)
      .maybeSingle();

    if (existingAppealResult.error) {
      return Response.json({ error: '소명 요청서 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (existingAppealResult.data) {
      return Response.json({ error: '이미 소명 요청서를 제출했습니다.' }, { status: 409 });
    }

    const contentState = await loadContentState(report);
    const now = new Date().toISOString();
    const insertResult = await supabaseAdmin
      .from('report_appeals')
      .insert({
        report_type: reportType,
        report_id: report.id,
        admin_status: 'request_submitted',
        appellant_status: 'request_arrived',
        submission_summary: submissionSummary,
        deletion_reason: deletionReason,
        appeal_request: appealRequest,
        request_submitted_at: now,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();

    if (insertResult.error || !insertResult.data) {
      const message = insertResult.error?.code === '23505' ? '이미 소명 요청서를 제출했습니다.' : '소명 요청서를 저장하지 못했습니다.';
      return Response.json({ error: message }, { status: insertResult.error?.code === '23505' ? 409 : 500 });
    }

    try {
      await deleteContent({
        report,
        reportType,
        handlerUserId: session.authUserId,
        now,
      });

      const reportUpdateResult = await supabaseAdmin
        .from(reportTable)
        .update({
          status: 'completed',
          handling_result: 'keep_deleted',
          handler_user_id: session.authUserId,
          handled_at: now,
          updated_at: now,
        })
        .eq('id', report.id)
        .select('id')
        .maybeSingle();

      if (reportUpdateResult.error || !reportUpdateResult.data) {
        throw new Error('신고 처리 상태를 저장하지 못했습니다.');
      }
    } catch (unknownError) {
      await restoreContentState(contentState);
      await supabaseAdmin.from('report_appeals').delete().eq('id', insertResult.data.id);
      throw unknownError;
    }

    return Response.json({ ok: true, appealId: insertResult.data.id });
  } catch (unknownError) {
    console.error('[concierge/reports/appeal] unexpected error', unknownError);

    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '소명 요청서를 제출하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '소명 요청서를 제출하지 못했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await verifySession({ siteId: null });

    if (session.case !== 'admin') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const { reportType: reportTypeParam, reportId: reportIdParam } = await context.params;
    const reportType = normalizeText(reportTypeParam);
    const reportId = normalizeText(reportIdParam);
    const body = (await request.json()) as PatchBody;
    const action = normalizeText(body.action);

    if ((reportType !== 'legal' && reportType !== 'rights') || !reportId) {
      return Response.json({ error: '신고 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    if (action !== 'restore' && action !== 'reject') {
      return Response.json({ error: '최종 처리 방식이 올바르지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const reportTable = reportTableByType[reportType];
    const reportResult = await supabaseAdmin
      .from(reportTable)
      .select('id, target_type, post_id, comment_id, reporter_user_id, site_id, board_id')
      .eq('id', reportId)
      .maybeSingle();

    if (reportResult.error || !reportResult.data) {
      return Response.json({ error: '신고 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    const report = reportResult.data as ReportRow;
    const appealResult = await supabaseAdmin
      .from('report_appeals')
      .select('id, admin_status, content_request')
      .eq('report_type', reportType)
      .eq('report_id', reportId)
      .maybeSingle();

    if (appealResult.error || !appealResult.data) {
      return Response.json({ error: '소명 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    const appeal = appealResult.data;
    const canHandleOriginalRequest =
      appeal.admin_status === 'opinion_received' && appeal.content_request === 'restore_original';
    const canHandleEditedContent =
      appeal.admin_status === 'edit_review_requested' && appeal.content_request === 'edit_and_review';

    if (!canHandleOriginalRequest && !canHandleEditedContent) {
      return Response.json({ error: '현재 상태에서는 소명을 처리할 수 없습니다.' }, { status: 409 });
    }

    if (action === 'restore') {
      await restoreDeletedContent(report);
    }

    const now = new Date().toISOString();
    const updateResult = await supabaseAdmin
      .from('report_appeals')
      .update({
        admin_status: action === 'restore' ? 'response_completed' : 'rejected',
        appellant_status: action === 'restore' ? 'succeeded' : 'failed',
        final_decision: action === 'restore' ? 'restore' : 'keep_deleted',
        final_handled_at: now,
        updated_at: now,
      })
      .eq('id', appeal.id)
      .eq('admin_status', appeal.admin_status)
      .select('id')
      .maybeSingle();

    if (updateResult.error || !updateResult.data) {
      return Response.json({ error: '소명 처리 결과를 저장하지 못했습니다.' }, { status: 500 });
    }

    const reportUpdateResult = await supabaseAdmin
      .from(reportTable)
      .update({
        status: 'completed',
        handling_result: action === 'restore' ? 'restore' : 'keep_deleted',
        handler_user_id: session.authUserId,
        handled_at: now,
        updated_at: now,
      })
      .eq('id', report.id)
      .select('id')
      .maybeSingle();

    if (reportUpdateResult.error || !reportUpdateResult.data) {
      return Response.json({ error: '신고 처리 결과를 저장하지 못했습니다.' }, { status: 500 });
    }

    await sendReporterResultNotification(report);

    return Response.json({ ok: true });
  } catch (unknownError) {
    console.error('[concierge/reports/appeal] final handling error', unknownError);

    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '소명을 처리하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '소명을 처리하지 못했습니다.' }, { status: 500 });
  }
}
