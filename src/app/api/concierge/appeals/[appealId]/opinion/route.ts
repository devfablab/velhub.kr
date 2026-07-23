import { randomUUID } from 'crypto';
import {
  appealOpinionFields,
  appealOpinionPositionOptions,
  isAppealOpinionFieldVisible,
} from '@/lib/reports/appealOpinion';
import {
  getReportAppealCategory,
  getReportAppealDeadline,
  isReportAppealContentRequest,
  type AppealOpinionContext,
  type ReportAppealCategory,
} from '@/lib/reports/appeals';
import { NOTIFICATION_TYPE } from '@/lib/notifications/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{ appealId: string }>;
};

type AppealRow = {
  id: string;
  report_type: 'legal' | 'rights';
  report_id: string;
  appellant_status: string;
};

type ReportRow = {
  id: string;
  target_type: 'post' | 'comment';
  post_id: string | null;
  comment_id: string | null;
  created_at: string;
  reporter_user_id: string;
  site_id: string | null;
  board_id: string | null;
  legal_type?: string | null;
  request_type?: string | null;
  false_manipulated_info_categories?: unknown;
  filming_reason_types?: unknown;
  reason_type?: string | null;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const BUCKET = 'report-appeals';

function normalizeUnknownText(value: unknown) {
  return typeof value === 'string' ? normalizeText(value) : '';
}

function getStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => normalizeText(item)).filter(Boolean) : [];
}

function getOpinionContext(report: ReportRow): AppealOpinionContext {
  const filmingReasonTypes = getStringArray(report.filming_reason_types);

  return {
    hasFalseManipulatedInfo:
      report.request_type === 'false_manipulated_info' ||
      getStringArray(report.false_manipulated_info_categories).length > 0,
    hasIllegalFilming: filmingReasonTypes.includes('illegal_filming'),
    hasDeepfake: filmingReasonTypes.includes('deepfake'),
    hasChildExploitation: filmingReasonTypes.includes('child_youth_sexual_exploitation'),
  };
}

function parseOpinionData(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') {
    return null;
  }

  try {
    const parsedValue = JSON.parse(value) as unknown;
    return parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue)
      ? (parsedValue as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function validateOpinionData({
  category,
  values,
  context,
}: {
  category: ReportAppealCategory;
  values: Record<string, unknown>;
  context: AppealOpinionContext;
}) {
  const normalizedValues: Record<string, string> = {};

  for (const field of appealOpinionFields[category]) {
    if (!isAppealOpinionFieldVisible(field, values, context)) {
      continue;
    }

    const value = normalizeUnknownText(values[field.key]);

    if (!value) {
      throw new Error(`${field.label} 항목을 입력해 주세요.`);
    }

    if (field.type === 'select' && !field.options?.some((option) => option.value === value)) {
      throw new Error(`${field.label} 항목이 올바르지 않습니다.`);
    }

    normalizedValues[field.key] = value;
  }

  return normalizedValues;
}

async function getContentAuthorId(report: ReportRow) {
  const supabaseAdmin = getSupabaseAdmin();

  if (report.target_type === 'post' && report.post_id) {
    const result = await supabaseAdmin.from('posts').select('user_id').eq('id', report.post_id).maybeSingle();
    return result.error ? null : normalizeText(result.data?.user_id);
  }

  if (report.target_type === 'comment' && report.comment_id) {
    const result = await supabaseAdmin.from('post_comments').select('user_id').eq('id', report.comment_id).maybeSingle();
    return result.error ? null : normalizeText(result.data?.user_id);
  }

  return null;
}

async function setEditPermission(report: ReportRow, expAt: string) {
  const supabaseAdmin = getSupabaseAdmin();

  if (report.target_type === 'post' && report.post_id) {
    const result = await supabaseAdmin.from('posts').update({ exp_at: expAt }).eq('id', report.post_id).select('id').maybeSingle();

    if (result.error || !result.data) {
      throw new Error('게시물 수정 권한을 제공하지 못했습니다.');
    }

    return;
  }

  if (report.target_type === 'comment' && report.comment_id) {
    const result = await supabaseAdmin
      .from('post_comments')
      .update({ exp_at: expAt })
      .eq('id', report.comment_id)
      .select('id')
      .maybeSingle();

    if (result.error || !result.data) {
      throw new Error('댓글 수정 권한을 제공하지 못했습니다.');
    }

    return;
  }

  throw new Error('수정할 콘텐츠가 없습니다.');
}

async function sendReporterResultNotification(report: ReportRow) {
  const supabaseAdmin = getSupabaseAdmin();
  const result = await supabaseAdmin.from('notifications').insert({
    user_id: report.reporter_user_id,
    send_user_id: null,
    target_id: null,
    send_site_id: report.site_id,
    send_board_id: report.board_id,
    send_series_id: null,
    send_post_id: report.post_id,
    notification_type: NOTIFICATION_TYPE.REPORT_RESULT,
    is_read: false,
  });

  if (result.error) {
    console.error('[concierge/appeals/opinion] reporter notification error', result.error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  let uploadedPath = '';

  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { appealId: appealIdParam } = await context.params;
    const appealId = normalizeText(appealIdParam);

    if (!appealId) {
      return Response.json({ error: '소명 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    const formData = await request.formData();
    const opinionPosition = normalizeUnknownText(formData.get('opinionPosition'));
    const disputedParts = normalizeUnknownText(formData.get('disputedParts'));
    const contentRequest = normalizeUnknownText(formData.get('contentRequest'));
    const modificationContent = normalizeUnknownText(formData.get('modificationContent')) || null;
    const opinionData = parseOpinionData(formData.get('opinionData'));
    const fileValue = formData.get('file');

    if (!disputedParts) {
      return Response.json({ error: '인정하거나 이의를 제기하는 부분을 입력해 주세요.' }, { status: 400 });
    }

    if (!isReportAppealContentRequest(contentRequest)) {
      return Response.json({ error: '게시물·댓글 처리 요청을 선택해 주세요.' }, { status: 400 });
    }

    if (contentRequest === 'edit_and_review' && !modificationContent) {
      return Response.json({ error: '수정 예정 내용을 입력해 주세요.' }, { status: 400 });
    }

    if (!(fileValue instanceof File) || fileValue.size <= 0) {
      return Response.json({ error: '첨부자료 PDF를 선택해 주세요.' }, { status: 400 });
    }

    if (fileValue.type !== 'application/pdf' || !fileValue.name.toLowerCase().endsWith('.pdf')) {
      return Response.json({ error: '첨부자료는 PDF 파일만 등록할 수 있습니다.' }, { status: 400 });
    }

    if (fileValue.size >= MAX_FILE_SIZE) {
      return Response.json({ error: '첨부자료는 10MB 미만의 PDF 파일만 등록할 수 있습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const appealResult = await supabaseAdmin
      .from('report_appeals')
      .select('id, report_type, report_id, appellant_status')
      .eq('id', appealId)
      .maybeSingle();

    if (appealResult.error || !appealResult.data) {
      return Response.json({ error: '소명 요청서를 찾을 수 없습니다.' }, { status: 404 });
    }

    const appeal = appealResult.data as AppealRow;

    if (appeal.appellant_status !== 'request_arrived') {
      return Response.json({ error: '이미 소명 의견서를 제출했습니다.' }, { status: 409 });
    }

    const reportTable = appeal.report_type === 'legal' ? 'report_legals' : 'report_rights';
    const reportColumns =
      appeal.report_type === 'legal'
        ? 'id, target_type, post_id, comment_id, created_at, reporter_user_id, site_id, board_id, legal_type, request_type, false_manipulated_info_categories, filming_reason_types'
        : 'id, target_type, post_id, comment_id, created_at, reporter_user_id, site_id, board_id, reason_type';
    const reportResult = await supabaseAdmin
      .from(reportTable)
      .select(reportColumns)
      .eq('id', appeal.report_id)
      .maybeSingle();

    if (reportResult.error || !reportResult.data) {
      return Response.json({ error: '신고 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    const report = reportResult.data as unknown as ReportRow;
    const authorUserId = await getContentAuthorId(report);

    if (!authorUserId || authorUserId !== session.authUserId) {
      return Response.json({ error: '이 소명 의견서를 작성할 권한이 없습니다.' }, { status: 403 });
    }

    if (getReportAppealDeadline(report.created_at).isExpired) {
      return Response.json({ error: '소명 의견서 제출 기한이 지났습니다.' }, { status: 409 });
    }

    const category = getReportAppealCategory({
      reportType: appeal.report_type,
      legalType: report.legal_type,
      reasonType: report.reason_type,
    });

    if (!category || !appealOpinionPositionOptions[category].some((option) => option.value === opinionPosition)) {
      return Response.json({ error: '소명 입장을 선택해 주세요.' }, { status: 400 });
    }

    if (!opinionData) {
      return Response.json({ error: '소명 의견서 내용이 올바르지 않습니다.' }, { status: 400 });
    }

    const normalizedOpinionData = validateOpinionData({
      category,
      values: opinionData,
      context: getOpinionContext(report),
    });
    const now = new Date().toISOString();
    uploadedPath = `${appeal.id}/${randomUUID()}.pdf`;
    const uploadResult = await supabaseAdmin.storage.from(BUCKET).upload(uploadedPath, fileValue, {
      contentType: 'application/pdf',
      upsert: false,
    });

    if (uploadResult.error) {
      console.error('[concierge/appeals/opinion] upload error', uploadResult.error);
      return Response.json({ error: '첨부자료를 업로드하지 못했습니다.' }, { status: 500 });
    }

    if (contentRequest === 'edit_and_review') {
      await setEditPermission(report, now);
    }

    const isDeletionAgreed = contentRequest === 'keep_deleted';
    const updateResult = await supabaseAdmin
      .from('report_appeals')
      .update({
        admin_status: isDeletionAgreed ? 'deletion_confirmed' : 'opinion_received',
        appellant_status: isDeletionAgreed ? 'deletion_agreed' : 'opinion_submitted',
        opinion_position: opinionPosition,
        disputed_parts: disputedParts,
        opinion_data: normalizedOpinionData,
        opinion_file: {
          bucket: BUCKET,
          path: uploadedPath,
          name: fileValue.name,
          size: fileValue.size,
          type: 'application/pdf',
        },
        content_request: contentRequest,
        modification_content: modificationContent,
        opinion_submitted_at: now,
        final_decision: isDeletionAgreed ? 'keep_deleted' : null,
        final_handled_at: isDeletionAgreed ? now : null,
        updated_at: now,
      })
      .eq('id', appeal.id)
      .eq('appellant_status', 'request_arrived')
      .select('id')
      .maybeSingle();

    if (updateResult.error || !updateResult.data) {
      await supabaseAdmin.storage.from(BUCKET).remove([uploadedPath]);
      uploadedPath = '';
      return Response.json({ error: '소명 의견서를 저장하지 못했습니다.' }, { status: 500 });
    }

    if (isDeletionAgreed) {
      await sendReporterResultNotification(report);
    }

    return Response.json({ ok: true });
  } catch (unknownError) {
    if (uploadedPath) {
      await getSupabaseAdmin().storage.from(BUCKET).remove([uploadedPath]);
    }

    console.error('[concierge/appeals/opinion] unexpected error', unknownError);

    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '소명 의견서를 제출하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '소명 의견서를 제출하지 못했습니다.' }, { status: 500 });
  }
}
