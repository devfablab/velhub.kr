import { normalizeText } from '@/lib/utils';

export const reportAppealCategories = [
  'illegal_info',
  'illegal_filming',
  'privacy',
  'defamation',
  'personality_rights',
] as const;

export type ReportAppealCategory = (typeof reportAppealCategories)[number];

export const reportAppealAdminStatuses = [
  'request_submitted',
  'opinion_received',
  'response_completed',
  'edit_review_requested',
  'rejected',
  'deletion_confirmed',
] as const;

export type ReportAppealAdminStatus = (typeof reportAppealAdminStatuses)[number];

export const reportAppealAppellantStatuses = [
  'request_arrived',
  'opinion_submitted',
  'decision_pending',
  'failed',
  'deletion_agreed',
  'succeeded',
] as const;

export type ReportAppealAppellantStatus = (typeof reportAppealAppellantStatuses)[number];

export const reportAppealContentRequests = ['restore_original', 'edit_and_review', 'keep_deleted'] as const;

export type ReportAppealContentRequest = (typeof reportAppealContentRequests)[number];

export type ReportAppealFinalDecision = 'keep_deleted' | 'restore';

export type StoredAppealFile = {
  bucket: string;
  path: string;
  name: string;
  size: number;
  type: string;
};

export type ReportAppealDatabaseRow = {
  id: string;
  report_type: string;
  report_id: string;
  admin_status: string;
  appellant_status: string;
  submission_summary: string;
  deletion_reason: string;
  appeal_request: string;
  request_submitted_at: string;
  opinion_position: string | null;
  disputed_parts: string | null;
  opinion_data: unknown;
  opinion_file: unknown;
  content_request: string | null;
  modification_content: string | null;
  opinion_submitted_at: string | null;
  edit_completed_at: string | null;
  final_decision: string | null;
  final_handled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReportAppeal = {
  id: string;
  reportType: 'legal' | 'rights';
  reportId: string;
  adminStatus: ReportAppealAdminStatus;
  adminStatusLabel: string;
  appellantStatus: ReportAppealAppellantStatus;
  appellantStatusLabel: string;
  submissionSummary: string;
  deletionReason: string;
  appealRequest: string;
  requestSubmittedAt: string;
  opinionPosition: string | null;
  disputedParts: string | null;
  opinionData: Record<string, unknown> | null;
  opinionFile: StoredAppealFile | null;
  contentRequest: ReportAppealContentRequest | null;
  modificationContent: string | null;
  opinionSubmittedAt: string | null;
  editCompletedAt: string | null;
  finalDecision: ReportAppealFinalDecision | null;
  finalHandledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AppealCenterDetail = {
  label: string;
  value: string;
};

export type AppealCenterItem = {
  reportId: string;
  reportType: 'legal' | 'rights';
  reportName: string;
  category: ReportAppealCategory;
  targetType: 'post' | 'comment';
  reportUrl: string;
  reportedAt: string;
  deadlineStartedOn: string;
  deadlineEndedOn: string;
  isExpired: boolean;
  siteName: string;
  siteLabel: string;
  boardName: string;
  boardLabel: string;
  contentId: string;
  postId: string;
  postTitle: string;
  commentId: string | null;
  commentContent: string | null;
  adminStatusLabel: string;
  appellantStatusLabel: string;
  appeal: ReportAppeal | null;
  reportDetails: AppealCenterDetail[];
  opinionContext: AppealOpinionContext;
  canSubmitOpinion: boolean;
  canEditContent: boolean;
  canRequestEditReview: boolean;
};

export type AppealOpinionContext = {
  [key: string]: string | boolean | null | undefined;
  hasFalseManipulatedInfo?: boolean;
  hasIllegalFilming?: boolean;
  hasDeepfake?: boolean;
  hasChildExploitation?: boolean;
};

export const reportAppealAdminStatusLabels: Record<ReportAppealAdminStatus, string> = {
  request_submitted: '소명 요청서 제출 완료',
  opinion_received: '소명 의견서 도착',
  response_completed: '소명 의견서 답변 완료',
  edit_review_requested: '수정 확인 요청 도착',
  rejected: '소명 반려',
  deletion_confirmed: '삭제 유지 확정',
};

export const reportAppealAppellantStatusLabels: Record<ReportAppealAppellantStatus, string> = {
  request_arrived: '소명 요청서 도착',
  opinion_submitted: '소명 의견서 제출',
  decision_pending: '처분 기다리는 중',
  failed: '소명 실패',
  deletion_agreed: '삭제 유지 동의 완료',
  succeeded: '소명 성공',
};

export const reportAppealContentRequestLabels: Record<ReportAppealContentRequest, string> = {
  restore_original: '원래 내용 그대로 복구 요청',
  edit_and_review: '직접 수정 후 재검토 요청',
  keep_deleted: '삭제 유지에 동의',
};

type DeletionReasonOption = {
  value: string;
  label: string;
};

const reviewRequiredOption: DeletionReasonOption = {
  value: 'review_required',
  label: '신고 내용 및 제출 자료 검토 필요',
};

export const reportAppealDeletionReasonOptions: Record<ReportAppealCategory, DeletionReasonOption[]> = {
  illegal_info: [
    reviewRequiredOption,
    { value: 'violation_confirmed', label: '불법정보 또는 허위조작정보 확인' },
    { value: 'external_review_required', label: '외부 심의 필요' },
  ],
  illegal_filming: [
    reviewRequiredOption,
    { value: 'violation_confirmed', label: '불법촬영물등 확인' },
    { value: 'external_review_required', label: '외부 심의 필요' },
  ],
  privacy: [reviewRequiredOption, { value: 'violation_confirmed', label: '개인정보 노출 확인' }],
  defamation: [reviewRequiredOption, { value: 'violation_confirmed', label: '명예훼손 확인' }],
  personality_rights: [
    reviewRequiredOption,
    { value: 'violation_confirmed', label: '초상권·사생활 등 인격권 침해 확인' },
  ],
};

export function isReportAppealAdminStatus(value: unknown): value is ReportAppealAdminStatus {
  return reportAppealAdminStatuses.includes(value as ReportAppealAdminStatus);
}

export function isReportAppealAppellantStatus(value: unknown): value is ReportAppealAppellantStatus {
  return reportAppealAppellantStatuses.includes(value as ReportAppealAppellantStatus);
}

export function isReportAppealContentRequest(value: unknown): value is ReportAppealContentRequest {
  return reportAppealContentRequests.includes(value as ReportAppealContentRequest);
}

export function normalizeReportAppeal(row: ReportAppealDatabaseRow): ReportAppeal | null {
  if (
    (row.report_type !== 'legal' && row.report_type !== 'rights') ||
    !isReportAppealAdminStatus(row.admin_status) ||
    !isReportAppealAppellantStatus(row.appellant_status)
  ) {
    return null;
  }

  const opinionData =
    row.opinion_data && typeof row.opinion_data === 'object' && !Array.isArray(row.opinion_data)
      ? (row.opinion_data as Record<string, unknown>)
      : null;
  const contentRequest = isReportAppealContentRequest(row.content_request) ? row.content_request : null;
  const finalDecision: ReportAppealFinalDecision | null =
    row.final_decision === 'keep_deleted' || row.final_decision === 'restore' ? row.final_decision : null;
  const storedFile =
    row.opinion_file && typeof row.opinion_file === 'object' && !Array.isArray(row.opinion_file)
      ? (row.opinion_file as Partial<StoredAppealFile>)
      : null;
  const fileBucket = normalizeText(storedFile?.bucket);
  const filePath = normalizeText(storedFile?.path);
  const fileName = normalizeText(storedFile?.name);
  const fileSize = Number(storedFile?.size);
  const fileType = normalizeText(storedFile?.type);
  const opinionFile: StoredAppealFile | null =
    fileBucket && filePath && fileName && Number.isFinite(fileSize) && fileSize >= 0 && fileType
      ? { bucket: fileBucket, path: filePath, name: fileName, size: fileSize, type: fileType }
      : null;

  return {
    id: row.id,
    reportType: row.report_type,
    reportId: row.report_id,
    adminStatus: row.admin_status,
    adminStatusLabel: reportAppealAdminStatusLabels[row.admin_status],
    appellantStatus: row.appellant_status,
    appellantStatusLabel: reportAppealAppellantStatusLabels[row.appellant_status],
    submissionSummary: row.submission_summary,
    deletionReason: row.deletion_reason,
    appealRequest: row.appeal_request,
    requestSubmittedAt: row.request_submitted_at,
    opinionPosition: row.opinion_position,
    disputedParts: row.disputed_parts,
    opinionData,
    opinionFile,
    contentRequest,
    modificationContent: row.modification_content,
    opinionSubmittedAt: row.opinion_submitted_at,
    editCompletedAt: row.edit_completed_at,
    finalDecision,
    finalHandledAt: row.final_handled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getReportAppealCategory({
  reportType,
  legalType,
  reasonType,
}: {
  reportType: string;
  legalType?: string | null;
  reasonType?: string | null;
}): ReportAppealCategory | null {
  if (reportType === 'legal') {
    const normalizedLegalType = normalizeText(legalType);

    if (
      normalizedLegalType === 'illegal_info' ||
      normalizedLegalType === 'illegal_filming' ||
      normalizedLegalType === 'privacy'
    ) {
      return normalizedLegalType;
    }
  }

  if (reportType === 'rights') {
    const normalizedReasonType = normalizeText(reasonType);

    if (normalizedReasonType === 'defamation' || normalizedReasonType === 'personality_rights') {
      return normalizedReasonType;
    }
  }

  return null;
}

export function isAppealDeletionReason(category: ReportAppealCategory, value: unknown) {
  const normalizedValue = typeof value === 'string' ? normalizeText(value) : '';
  return reportAppealDeletionReasonOptions[category].some((option) => option.value === normalizedValue);
}

export function getAppealTreatmentMessage({
  category,
  deletionReason,
  targetType,
}: {
  category: ReportAppealCategory;
  deletionReason: string;
  targetType: 'post' | 'comment';
}) {
  const targetLabel = targetType === 'post' ? '게시물' : '댓글';
  const authorLabel = targetType === 'post' ? '게시자' : '작성자';

  if (deletionReason === 'review_required') {
    return `신고 내용과 제출 자료를 검토하고 ${authorLabel}의 소명을 확인하기 위해 ${targetLabel}을 삭제했습니다.`;
  }

  if (deletionReason === 'external_review_required') {
    const subject = category === 'illegal_filming' ? '신고된 자료가 불법촬영물등' : '신고된 내용이 불법정보 또는 허위조작정보';
    return `${subject}에 해당하는지 판단하기 어려워 외부 심의를 요청하고 ${targetLabel}을 삭제했습니다.`;
  }

  const violationText: Record<ReportAppealCategory, string> = {
    illegal_info: '불법정보 또는 허위조작정보에 해당하는 내용이',
    illegal_filming: '불법촬영물등에 해당하는 자료가',
    privacy: '개인정보가 노출된 사실이',
    defamation: '타인의 명예를 훼손하는 내용이',
    personality_rights: '타인의 초상권·사생활 등 인격권을 침해하는 내용이',
  };

  return `신고 내용과 제출 자료를 검토한 결과 ${violationText[category]} 확인되어 ${targetLabel}을 삭제했습니다.`;
}

export function getReportAppealDeadline(createdAt: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const startedOn = formatter.format(new Date(createdAt));
  const [year, month, day] = startedOn.split('-').map(Number);
  const endDate = new Date(Date.UTC(year, month - 1, day + 29));
  const endedOn = endDate.toISOString().slice(0, 10);
  const expiresAt = new Date(`${endedOn}T23:59:59.999+09:00`).getTime();

  return {
    startedOn,
    endedOn,
    expiresAt,
    isExpired: Date.now() > expiresAt,
  };
}
