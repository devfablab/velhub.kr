import {
  normalizeReportAppeal,
  getReportAppealDeadline,
  type AppealCenterDetail,
  type AppealCenterItem,
  type AppealOpinionContext,
  type ReportAppealDatabaseRow,
} from '@/lib/reports/appeals';
import { legalTypeLabels, legalValueLabels, rightsReasonTypeLabels } from '@/lib/reports/concierge';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type ReportType = 'legal' | 'rights';

type RawReport = {
  id: string;
  reportType: ReportType;
  target_type: string;
  site_id: string | null;
  board_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  report_url: string | null;
  created_at: string;
  legal_type?: string | null;
  request_type?: string | null;
  illegal_info_categories?: unknown;
  false_manipulated_info_categories?: unknown;
  report_content?: string | null;
  report_reason?: string | null;
  report_basis?: string | null;
  filming_request_types?: unknown;
  filming_reason_types?: unknown;
  filming_target?: string | null;
  privacy_report_type?: string | null;
  exposed_information?: string | null;
  privacy_request_reason?: string | null;
  reason_type?: string | null;
  rights_owner_type?: string | null;
  reporter_capacity?: string | null;
  rights_holder_name?: string | null;
  infringement_reason?: string | null;
};

type PostRow = {
  id: string;
  site_id: string;
  board_id: string;
  slug: string | number;
  subject: string | null;
  user_id: string;
  is_closed: boolean;
  updated_at: string | null;
  exp_at: string | null;
};

type CommentRow = {
  id: string;
  site_id: string;
  board_id: string;
  post_id: string;
  user_id: string;
  content: string | null;
  is_deleted: boolean;
  updated_at: string | null;
  exp_at: string | null;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
};

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string | null;
};

const appealColumns =
  'id, report_type, report_id, admin_status, appellant_status, submission_summary, deletion_reason, appeal_request, request_submitted_at, opinion_position, disputed_parts, opinion_data, opinion_file, content_request, modification_content, opinion_submitted_at, edit_completed_at, final_decision, final_handled_at, created_at, updated_at';

const legalColumns =
  'id, target_type, site_id, board_id, post_id, comment_id, report_url, created_at, legal_type, request_type, illegal_info_categories, false_manipulated_info_categories, report_content, report_reason, report_basis, filming_request_types, filming_reason_types, filming_target, privacy_report_type, exposed_information, privacy_request_reason';

const rightsColumns =
  'id, target_type, site_id, board_id, post_id, comment_id, report_url, created_at, reason_type, rights_owner_type, reporter_capacity, rights_holder_name, infringement_reason';

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => normalizeText(item)).filter(Boolean) : [];
}

function normalizeUnknownText(value: unknown) {
  return typeof value === 'string' ? normalizeText(value) : '';
}

function getArrayLabel(value: unknown) {
  return normalizeStringArray(value)
    .map((item) => legalValueLabels[item] ?? item)
    .join(', ');
}

function addDetail(details: AppealCenterDetail[], label: string, value: unknown) {
  const normalizedValue = normalizeUnknownText(value);

  if (normalizedValue) {
    details.push({ label, value: normalizedValue });
  }
}

function getReportDetails(report: RawReport) {
  const details: AppealCenterDetail[] = [];

  if (report.reportType === 'legal' && report.legal_type === 'illegal_info') {
    addDetail(details, '신고·요청 구분', legalValueLabels[normalizeText(report.request_type)] ?? report.request_type);
    addDetail(details, '불법정보 신고·요청 구분', getArrayLabel(report.illegal_info_categories));
    addDetail(details, '허위조작정보 신고·요청 구분', getArrayLabel(report.false_manipulated_info_categories));
    addDetail(details, '신고 내용', report.report_content);
    addDetail(details, '신고 이유', report.report_reason);
    addDetail(details, '신고 근거', report.report_basis);
  } else if (report.reportType === 'legal' && report.legal_type === 'illegal_filming') {
    addDetail(details, '신고·요청 구분', getArrayLabel(report.filming_request_types));
    addDetail(details, '신고·요청 사유', getArrayLabel(report.filming_reason_types));
    addDetail(details, '신고·요청 대상', report.filming_target);
  } else if (report.reportType === 'legal' && report.legal_type === 'privacy') {
    addDetail(details, '개인정보 신고유형', legalValueLabels[normalizeText(report.privacy_report_type)] ?? report.privacy_report_type);
    addDetail(details, '노출된 정보', report.exposed_information);
    addDetail(details, '요청사유', report.privacy_request_reason);
  } else if (report.reportType === 'rights') {
    addDetail(details, '권리 소유자', legalValueLabels[normalizeText(report.rights_owner_type)] ?? report.rights_owner_type);
    addDetail(details, '권리 침해 대상', report.rights_holder_name);
    addDetail(
      details,
      '신고자와 권리 침해 대상의 관계',
      legalValueLabels[normalizeText(report.reporter_capacity)] ?? report.reporter_capacity,
    );
    addDetail(details, '권리침해 내용 및 신고 사유', report.infringement_reason);
  }

  return details;
}

function getOpinionContext(report: RawReport): AppealOpinionContext {
  const filmingReasonTypes = normalizeStringArray(report.filming_reason_types);

  return {
    hasFalseManipulatedInfo:
      report.request_type === 'false_manipulated_info' ||
      normalizeStringArray(report.false_manipulated_info_categories).length > 0,
    hasIllegalFilming: filmingReasonTypes.includes('illegal_filming'),
    hasDeepfake: filmingReasonTypes.includes('deepfake'),
    hasChildExploitation: filmingReasonTypes.includes('child_youth_sexual_exploitation'),
  };
}

async function loadReportsForTargets({ postIds, commentIds }: { postIds: string[]; commentIds: string[] }) {
  const supabaseAdmin = getSupabaseAdmin();
  const requests: Promise<{ data: unknown[] | null; error: { message?: string } | null; reportType: ReportType }>[] = [];

  function addRequest(reportType: ReportType, column: 'post_id' | 'comment_id', ids: string[]) {
    if (ids.length === 0) {
      return;
    }

    const table = reportType === 'legal' ? 'report_legals' : 'report_rights';
    const columns = reportType === 'legal' ? legalColumns : rightsColumns;
    const subtypeColumn = reportType === 'legal' ? 'legal_type' : 'reason_type';
    const allowedTypes =
      reportType === 'legal'
        ? ['illegal_info', 'illegal_filming', 'privacy']
        : ['defamation', 'personality_rights'];

    requests.push(
      (async () => {
        const result = await supabaseAdmin
          .from(table)
          .select(columns)
          .eq('target_type', column === 'post_id' ? 'post' : 'comment')
          .in(column, ids)
          .in(subtypeColumn, allowedTypes);

        return {
          data: (result.data ?? null) as unknown[] | null,
          error: result.error,
          reportType,
        };
      })(),
    );
  }

  addRequest('legal', 'post_id', postIds);
  addRequest('legal', 'comment_id', commentIds);
  addRequest('rights', 'post_id', postIds);
  addRequest('rights', 'comment_id', commentIds);

  const results = await Promise.all(requests);
  const error = results.find((result) => result.error)?.error;

  if (error) {
    console.error('[concierge/appeals] report query error', error);
    throw new Error('신고 내역을 불러오지 못했습니다.');
  }

  const reportMap = new Map<string, RawReport>();

  for (const result of results) {
    for (const row of result.data ?? []) {
      const report = { ...(row as Omit<RawReport, 'reportType'>), reportType: result.reportType };
      reportMap.set(`${result.reportType}:${report.id}`, report);
    }
  }

  return [...reportMap.values()].sort((first, second) => second.created_at.localeCompare(first.created_at));
}

export async function loadAppealCenterItems({ authUserId, origin }: { authUserId: string; origin: string }) {
  const supabaseAdmin = getSupabaseAdmin();
  const [ownPostsResult, ownCommentsResult] = await Promise.all([
    supabaseAdmin.from('posts').select('id').eq('user_id', authUserId),
    supabaseAdmin
      .from('post_comments')
      .select('id, site_id, board_id, post_id, user_id, content, is_deleted, updated_at, exp_at')
      .eq('user_id', authUserId),
  ]);

  if (ownPostsResult.error || ownCommentsResult.error) {
    console.error('[concierge/appeals] owned content query error', ownPostsResult.error ?? ownCommentsResult.error);
    throw new Error('소명 대상 콘텐츠를 불러오지 못했습니다.');
  }

  const ownPostIds = (ownPostsResult.data ?? []).map((row) => row.id as string);
  const comments = (ownCommentsResult.data ?? []) as CommentRow[];
  const ownCommentIds = comments.map((comment) => comment.id);
  const reports = await loadReportsForTargets({ postIds: ownPostIds, commentIds: ownCommentIds });

  if (reports.length === 0) {
    return [];
  }

  const reportIds = reports.map((report) => report.id);
  const postIds = [
    ...new Set(
      reports
        .map((report) => report.post_id ?? comments.find((comment) => comment.id === report.comment_id)?.post_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const [postsResult, appealsResult] = await Promise.all([
    supabaseAdmin
      .from('posts')
      .select('id, site_id, board_id, slug, subject, user_id, is_closed, updated_at, exp_at')
      .in('id', postIds),
    supabaseAdmin.from('report_appeals').select(appealColumns).in('report_id', reportIds),
  ]);

  if (postsResult.error || appealsResult.error) {
    console.error('[concierge/appeals] related query error', postsResult.error ?? appealsResult.error);
    throw new Error('소명 관련 정보를 불러오지 못했습니다.');
  }

  const posts = (postsResult.data ?? []) as PostRow[];
  const postById = new Map(posts.map((post) => [post.id, post]));
  const commentById = new Map(comments.map((comment) => [comment.id, comment]));
  const siteIds = [...new Set(reports.map((report) => report.site_id).filter((value): value is string => Boolean(value)))];
  const boardIds = [...new Set(reports.map((report) => report.board_id).filter((value): value is string => Boolean(value)))];
  const [sitesResult, boardsResult] = await Promise.all([
    supabaseAdmin.from('rhizomes').select('id, site_key, site_label').in('id', siteIds),
    supabaseAdmin.from('boards').select('id, board_key, board_label').in('id', boardIds),
  ]);

  if (sitesResult.error || boardsResult.error) {
    throw new Error('사이트와 게시판 정보를 불러오지 못했습니다.');
  }

  const siteById = new Map(((sitesResult.data ?? []) as SiteRow[]).map((site) => [site.id, site]));
  const boardById = new Map(((boardsResult.data ?? []) as BoardRow[]).map((board) => [board.id, board]));
  const appealByReport = new Map<string, ReturnType<typeof normalizeReportAppeal>>();

  for (const row of (appealsResult.data ?? []) as ReportAppealDatabaseRow[]) {
    const appeal = normalizeReportAppeal(row);

    if (appeal) {
      appealByReport.set(`${appeal.reportType}:${appeal.reportId}`, appeal);
    }
  }

  return reports.flatMap((report): AppealCenterItem[] => {
    const comment = report.comment_id ? commentById.get(report.comment_id) : null;
    const post = postById.get(report.post_id ?? comment?.post_id ?? '');
    const site = report.site_id ? siteById.get(report.site_id) : null;
    const board = report.board_id ? boardById.get(report.board_id) : null;

    if (!post || !site || !board) {
      return [];
    }

    const category =
      report.reportType === 'legal'
        ? report.legal_type
        : report.reason_type;

    if (
      category !== 'illegal_info' &&
      category !== 'illegal_filming' &&
      category !== 'privacy' &&
      category !== 'defamation' &&
      category !== 'personality_rights'
    ) {
      return [];
    }

    const appeal = appealByReport.get(`${report.reportType}:${report.id}`) ?? null;
    const deadline = getReportAppealDeadline(report.created_at);
    const targetUpdatedAt = comment?.updated_at ?? post.updated_at;
    const targetExpAt = comment?.exp_at ?? post.exp_at;
    const hasEditedAfterPermission = Boolean(
      targetUpdatedAt && targetExpAt && new Date(targetUpdatedAt).getTime() > new Date(targetExpAt).getTime(),
    );
    const internalPath = `/${site.site_key}/${board.board_key}/${post.slug}`;
    const reportUrl = normalizeText(report.report_url) || new URL(internalPath, origin).toString();

    return [
      {
        reportId: report.id,
        reportType: report.reportType,
        reportName:
          report.reportType === 'legal'
            ? (legalTypeLabels[category] ?? category)
            : (rightsReasonTypeLabels[category] ?? category),
        category,
        targetType: report.target_type as 'post' | 'comment',
        reportUrl,
        reportedAt: report.created_at,
        deadlineStartedOn: deadline.startedOn,
        deadlineEndedOn: deadline.endedOn,
        isExpired: deadline.isExpired,
        siteName: site.site_key,
        siteLabel: site.site_label || site.site_key,
        boardName: board.board_key,
        boardLabel: board.board_label || board.board_key,
        contentId: String(post.slug),
        postId: post.id,
        postTitle: post.subject || '제목 없음',
        commentId: comment?.id ?? null,
        commentContent: comment?.content ?? null,
        adminStatusLabel: appeal?.adminStatusLabel ?? '소명 요청서 제출 전',
        appellantStatusLabel: appeal?.appellantStatusLabel ?? '소명 요청서 도착 전',
        appeal,
        reportDetails: getReportDetails(report),
        opinionContext: getOpinionContext(report),
        canSubmitOpinion:
          Boolean(appeal) && appeal?.appellantStatus === 'request_arrived' && !deadline.isExpired,
        canEditContent:
          appeal?.contentRequest === 'edit_and_review' &&
          appeal.appellantStatus === 'opinion_submitted' &&
          !appeal.editCompletedAt,
        canRequestEditReview:
          appeal?.contentRequest === 'edit_and_review' &&
          appeal.appellantStatus === 'opinion_submitted' &&
          !appeal.editCompletedAt &&
          hasEditedAfterPermission,
      },
    ];
  });
}
