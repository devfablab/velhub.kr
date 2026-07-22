import { decrypt } from '@/lib/encryption/decrypt';
import {
  conciergeReportTypeLabels,
  conciergeTargetTypeLabels,
  legalTypeLabels,
  legalValueLabels,
  rightsReasonTypeLabels,
  type ConciergeReportItem,
  type ConciergeReportType,
  type ReportDetail,
  type ReportMessage,
} from '@/lib/reports/concierge';
import { getReportCategoryTitle, isReportStatus, reportStatusLabels, type ReportStatus } from '@/lib/reports/manage';
import { isReportTargetType, type ReportTargetType } from '@/lib/reports/guidelines';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RawReport = {
  id: string;
  target_type: string | null;
  target_id: string | null;
  site_id: string | null;
  board_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  reporter_user_id: string;
  status: string;
  created_at: string;
  handled_at: string | null;
  handler_user_id: string | null;
  updated_at: string | null;
  report_category?: string | null;
  legal_type?: string | null;
  report_url?: string | null;
  email?: string | null;
  phone?: string | null;
  attachments?: unknown;
  request_type?: string | null;
  illegal_info_categories?: unknown;
  false_manipulated_info_categories?: unknown;
  report_content?: string | null;
  report_reason?: string | null;
  report_basis?: string | null;
  illegal_info_confirmed?: boolean | null;
  false_manipulated_info_confirmed?: boolean | null;
  illegal_info_notice_confirmed?: boolean | null;
  filming_request_types?: unknown;
  filming_reason_types?: unknown;
  filming_target?: string | null;
  filming_request_confirmed?: boolean | null;
  filming_notice_confirmed?: boolean | null;
  privacy_report_type?: string | null;
  exposed_information?: string | null;
  privacy_request_reason?: string | null;
  reason_type?: string | null;
  rights_owner_type?: string | null;
  reporter_capacity?: string | null;
  rights_holder_name?: string | null;
  rights_holder_phone?: string | null;
  rights_holder_proof_file?: unknown;
  delegation_started_on?: string | null;
  delegation_ended_on?: string | null;
  power_of_attorney_file?: unknown;
  infringement_reason?: string | null;
  infringement_evidence_file?: unknown;
  copyright_original_urls?: unknown;
  copyright_proof_files?: unknown;
};

type UnifiedRawReport = RawReport & {
  reportType: ConciergeReportType;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
  is_blocked: boolean | null;
};

type SubscriptionRow = {
  target_id: string;
  status: string;
  next_billing_at: string | null;
  canceled_at: string | null;
  created_at: string;
};

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string | null;
};

type PostRow = {
  id: string;
  board_id: string;
  slug: string | number;
  subject: string | null;
};

type CommentRow = {
  id: string;
  post_id: string;
  content: string | null;
};

type StigmaRow = {
  user_id: string;
  user_name: string | null;
};

type ChorogonRow = {
  user_id: string;
  name: string | null;
};

type MessageRow = {
  id: string;
  report_type: ConciergeReportType;
  report_id: string;
  sender_user_id: string | null;
  recipient_user_id: string | null;
  message: string;
  created_at: string;
};

type StoredFile = {
  bucket?: string | null;
  path?: string | null;
  name?: string | null;
};

const commonColumns = [
  'id',
  'target_type',
  'target_id',
  'site_id',
  'board_id',
  'post_id',
  'comment_id',
  'reporter_user_id',
  'status',
  'created_at',
  'handled_at',
  'handler_user_id',
  'updated_at',
];

const guidelineColumns = [...commonColumns, 'report_category'].join(', ');

const legalColumns = [
  ...commonColumns,
  'legal_type',
  'report_url',
  'email',
  'phone',
  'attachments',
  'request_type',
  'illegal_info_categories',
  'false_manipulated_info_categories',
  'report_content',
  'report_reason',
  'report_basis',
  'illegal_info_confirmed',
  'false_manipulated_info_confirmed',
  'illegal_info_notice_confirmed',
  'filming_request_types',
  'filming_reason_types',
  'filming_target',
  'filming_request_confirmed',
  'filming_notice_confirmed',
  'privacy_report_type',
  'exposed_information',
  'privacy_request_reason',
].join(', ');

const rightsColumns = [
  ...commonColumns,
  'report_url',
  'email',
  'phone',
  'reason_type',
  'rights_owner_type',
  'reporter_capacity',
  'rights_holder_name',
  'rights_holder_phone',
  'rights_holder_proof_file',
  'delegation_started_on',
  'delegation_ended_on',
  'power_of_attorney_file',
  'infringement_reason',
  'infringement_evidence_file',
  'copyright_original_urls',
  'copyright_proof_files',
].join(', ');

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

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => normalizeText(item)).filter(Boolean);
}

function normalizeFiles(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is StoredFile => typeof item === 'object' && item !== null);
  }

  if (typeof value === 'object' && value !== null) {
    return [value as StoredFile];
  }

  return [];
}

function getStatus(value: string): ReportStatus {
  return isReportStatus(value) ? value : 'received';
}

function getTargetType(value: string | null): ReportTargetType | null {
  return isReportTargetType(value) ? value : null;
}

function getLabel(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);
  return legalValueLabels[normalizedValue] ?? normalizedValue;
}

function getArrayLabel(value: unknown) {
  return normalizeStringArray(value).map(getLabel).join(', ');
}

function getBooleanLabel(value: boolean | null | undefined) {
  return value === true ? '확인함' : '확인하지 않음';
}

function getFileDetails(label: string, value: unknown): ReportDetail {
  const links = normalizeFiles(value).flatMap((file) => {
    const bucket = normalizeText(file.bucket);
    const path = normalizeText(file.path);

    if (!bucket || !path) {
      return [];
    }

    const searchParams = new URLSearchParams({ bucket, path });

    return [
      {
        label: normalizeText(file.name) || '첨부 파일',
        href: `/api/concierge/reports/file?${searchParams.toString()}`,
      },
    ];
  });

  return {
    label,
    value: links.length > 0 ? null : '없음',
    links,
  };
}

function getLegalDetails(report: RawReport): ReportDetail[] {
  const reportUrl = normalizeText(report.report_url);
  const commonDetails: ReportDetail[] = [
    {
      label: '신고대상 URL',
      value: reportUrl ? null : '없음',
      links: reportUrl ? [{ label: reportUrl, href: reportUrl }] : [],
    },
    { label: '이메일', value: report.email ?? null },
    { label: '전화번호', value: report.phone ?? null },
    getFileDetails('첨부 파일', report.attachments),
  ];

  if (report.legal_type === 'illegal_info') {
    return [
      ...commonDetails,
      { label: '신고·요청 구분', value: getLabel(report.request_type) },
      { label: '불법정보 신고·요청 구분', value: getArrayLabel(report.illegal_info_categories) },
      { label: '허위조작 신고·요청 구분', value: getArrayLabel(report.false_manipulated_info_categories) },
      { label: '신고 내용', value: report.report_content ?? null },
      { label: '신고 이유', value: report.report_reason ?? null },
      { label: '신고 근거', value: report.report_basis ?? null },
      { label: '불법정보 신고·요청 확인', value: getBooleanLabel(report.illegal_info_confirmed) },
      { label: '허위조작정보 신고·요청 확인', value: getBooleanLabel(report.false_manipulated_info_confirmed) },
      { label: '유의사항 확인', value: getBooleanLabel(report.illegal_info_notice_confirmed) },
    ];
  }

  if (report.legal_type === 'illegal_filming') {
    return [
      ...commonDetails,
      { label: '신고·요청 구분', value: getArrayLabel(report.filming_request_types) },
      { label: '신고·요청 사유', value: getArrayLabel(report.filming_reason_types) },
      { label: '신고·요청 대상', value: report.filming_target ?? null },
      { label: '신고·요청 확인', value: getBooleanLabel(report.filming_request_confirmed) },
      { label: '유의사항 확인', value: getBooleanLabel(report.filming_notice_confirmed) },
    ];
  }

  return [
    ...commonDetails,
    { label: '신고유형', value: getLabel(report.privacy_report_type) },
    { label: '노출된 정보', value: report.exposed_information ?? null },
    { label: '요청사유', value: report.privacy_request_reason ?? null },
  ];
}

function getRightsDetails(report: RawReport): ReportDetail[] {
  const originalUrls = normalizeStringArray(report.copyright_original_urls);
  const reportUrl = normalizeText(report.report_url);
  const isOrganization = report.rights_owner_type === 'organization';
  const delegationPeriod =
    report.delegation_started_on && report.delegation_ended_on
      ? `${report.delegation_started_on} ~ ${report.delegation_ended_on}`
      : null;
  const ownerDetails: ReportDetail[] =
    report.reason_type === 'defamation' || report.reason_type === 'personality_rights'
      ? [
          { label: isOrganization ? '피해단체 대표' : '피해자 정보', value: getLabel(report.reporter_capacity) },
          { label: isOrganization ? '피해단체 이름' : '피해자 이름', value: report.rights_holder_name ?? null },
          {
            label: isOrganization ? '피해단체 전화번호' : '피해자 전화번호',
            value: report.rights_holder_phone ?? null,
          },
          getFileDetails(isOrganization ? '단체 증빙서류' : '피해자 신분증', report.rights_holder_proof_file),
          { label: '위임 기간', value: delegationPeriod },
          getFileDetails('위임장', report.power_of_attorney_file),
          { label: '권리침해 내용 및 신고 사유', value: report.infringement_reason ?? null },
          getFileDetails('권리침해 증빙자료', report.infringement_evidence_file),
        ]
      : [];

  return [
    {
      label: '신고대상 URL',
      value: reportUrl ? null : '없음',
      links: reportUrl ? [{ label: reportUrl, href: reportUrl }] : [],
    },
    { label: '이메일', value: report.email ?? null },
    { label: '전화번호', value: report.phone ?? null },
    { label: '권리 소유자', value: getLabel(report.rights_owner_type) },
    ...ownerDetails,
    {
      label: '저작물 원본 URL',
      value: originalUrls.length > 0 ? null : '없음',
      links: originalUrls.map((url) => ({ label: url, href: url })),
    },
    getFileDetails('원본 증명 PDF', report.copyright_proof_files),
  ];
}

function getDetails(report: UnifiedRawReport, targetType: ReportTargetType | null): ReportDetail[] {
  if (report.reportType === 'legal') {
    return getLegalDetails(report);
  }

  if (report.reportType === 'rights') {
    return getRightsDetails(report);
  }

  return [
    {
      label: '위반 내용',
      value:
        targetType && report.report_category
          ? getReportCategoryTitle(targetType, report.report_category)
          : (report.report_category ?? null),
    },
  ];
}

function getReportName(report: UnifiedRawReport, targetType: ReportTargetType | null) {
  if (report.reportType === 'legal') {
    return legalTypeLabels[normalizeText(report.legal_type)] ?? (normalizeText(report.legal_type) || '법률 위반');
  }

  if (report.reportType === 'rights') {
    return (
      rightsReasonTypeLabels[normalizeText(report.reason_type)] ?? (normalizeText(report.reason_type) || '권리침해')
    );
  }

  if (targetType && report.report_category) {
    return getReportCategoryTitle(targetType, report.report_category);
  }

  return normalizeText(report.report_category) || '가이드라인 위반';
}

async function loadRawReports({
  reportType,
  targetType,
  reporterUserId,
}: {
  reportType: ConciergeReportType | null;
  targetType: ReportTargetType | null;
  reporterUserId: string | null;
}) {
  const supabaseAdmin = getSupabaseAdmin();

  async function loadTable(type: ConciergeReportType, table: string, columns: string) {
    let query = supabaseAdmin.from(table).select(columns);

    if (targetType) {
      query = query.eq('target_type', targetType);
    }

    if (reporterUserId) {
      query = query.eq('reporter_user_id', reporterUserId);
    }

    const result = await query.order('created_at', { ascending: false });

    if (result.error) {
      console.error(`[concierge/reports] ${table} query error`, result.error);
      throw new Error('신고 목록을 불러오지 못했습니다.');
    }

    return ((result.data ?? []) as unknown as RawReport[]).map((report) => ({ ...report, reportType: type }));
  }

  const queries: Promise<UnifiedRawReport[]>[] = [];

  if (!reportType || reportType === 'guideline') {
    queries.push(loadTable('guideline', 'report_guidelines', guidelineColumns));
  }

  if (!reportType || reportType === 'legal') {
    queries.push(loadTable('legal', 'report_legals', legalColumns));
  }

  if (!reportType || reportType === 'rights') {
    queries.push(loadTable('rights', 'report_rights', rightsColumns));
  }

  return (await Promise.all(queries)).flat().sort((first, second) => second.created_at.localeCompare(first.created_at));
}

export async function loadConciergeReports({
  reportType,
  targetType,
  reporterUserId,
  page,
  pageSize,
}: {
  reportType: ConciergeReportType | null;
  targetType: ReportTargetType | null;
  reporterUserId: string | null;
  page: number;
  pageSize: number;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const allReports = await loadRawReports({ reportType, targetType, reporterUserId });
  const total = allReports.length;
  const reports = reporterUserId ? allReports : allReports.slice(page * pageSize, (page + 1) * pageSize);

  const siteIds = [
    ...new Set(reports.map((report) => report.site_id).filter((value): value is string => Boolean(value))),
  ];
  const boardIds = [
    ...new Set(reports.map((report) => report.board_id).filter((value): value is string => Boolean(value))),
  ];
  const postIds = [
    ...new Set(reports.map((report) => report.post_id).filter((value): value is string => Boolean(value))),
  ];
  const commentIds = [
    ...new Set(reports.map((report) => report.comment_id).filter((value): value is string => Boolean(value))),
  ];
  const reportKeys = new Set(reports.map((report) => `${report.reportType}:${report.id}`));

  const [sitesResult, boardsResult, postsResult, commentsResult, messagesResult, subscriptionsResult] =
    await Promise.all([
      siteIds.length
        ? supabaseAdmin.from('rhizomes').select('id, site_key, site_label, is_blocked').in('id', siteIds)
        : Promise.resolve({ data: [], error: null }),
      boardIds.length
        ? supabaseAdmin.from('boards').select('id, board_key, board_label').in('id', boardIds)
        : Promise.resolve({ data: [], error: null }),
      postIds.length
        ? supabaseAdmin.from('posts').select('id, board_id, slug, subject').in('id', postIds)
        : Promise.resolve({ data: [], error: null }),
      commentIds.length
        ? supabaseAdmin.from('post_comments').select('id, post_id, content').in('id', commentIds)
        : Promise.resolve({ data: [], error: null }),
      reports.length
        ? supabaseAdmin
            .from('report_messages')
            .select('id, report_type, report_id, sender_user_id, recipient_user_id, message, created_at')
            .in(
              'report_id',
              reports.map((report) => report.id),
            )
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      siteIds.length
        ? supabaseAdmin
            .from('subscriptions')
            .select('target_id, status, next_billing_at, canceled_at, created_at')
            .eq('subscription_type', 'plan_billing')
            .eq('target_type', 'plan')
            .in('target_id', siteIds)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

  const firstError =
    sitesResult.error ??
    boardsResult.error ??
    postsResult.error ??
    commentsResult.error ??
    messagesResult.error ??
    subscriptionsResult.error;

  if (firstError) {
    console.error('[concierge/reports] related data error', firstError);
    throw new Error('신고 관련 정보를 불러오지 못했습니다.');
  }

  const messages = ((messagesResult.data ?? []) as MessageRow[]).filter((message) =>
    reportKeys.has(`${message.report_type}:${message.report_id}`),
  );
  const userIds = [
    ...new Set(
      [
        ...reports.map((report) => report.reporter_user_id),
        ...messages.flatMap((message) => [message.sender_user_id, message.recipient_user_id]),
      ].filter((value): value is string => Boolean(value)),
    ),
  ];

  const [stigmasResult, chorogonsResult] = await Promise.all([
    userIds.length
      ? supabaseAdmin.from('stigmas').select('user_id, user_name').in('user_id', userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabaseAdmin.from('chorogons').select('user_id, name').in('user_id', userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (stigmasResult.error || chorogonsResult.error) {
    console.error('[concierge/reports] user data error', stigmasResult.error ?? chorogonsResult.error);
    throw new Error('신고자 정보를 불러오지 못했습니다.');
  }

  const stigmaNameMap = new Map(
    ((stigmasResult.data ?? []) as StigmaRow[]).map((stigma) => [stigma.user_id, decryptValue(stigma.user_name)]),
  );
  const identityNameMap = new Map(
    ((chorogonsResult.data ?? []) as ChorogonRow[]).map((chorogon) => [chorogon.user_id, decryptValue(chorogon.name)]),
  );

  function getUserName(userId: string | null) {
    if (!userId) {
      return '사용자';
    }

    return identityNameMap.get(userId) || stigmaNameMap.get(userId) || '사용자';
  }

  const siteById = new Map(((sitesResult.data ?? []) as SiteRow[]).map((site) => [site.id, site]));
  const latestSubscriptionBySiteId = new Map<string, SubscriptionRow>();

  for (const subscription of (subscriptionsResult.data ?? []) as SubscriptionRow[]) {
    if (!latestSubscriptionBySiteId.has(subscription.target_id)) {
      latestSubscriptionBySiteId.set(subscription.target_id, subscription);
    }
  }
  const boardById = new Map(((boardsResult.data ?? []) as BoardRow[]).map((board) => [board.id, board]));
  const postById = new Map(((postsResult.data ?? []) as PostRow[]).map((post) => [post.id, post]));
  const commentById = new Map(((commentsResult.data ?? []) as CommentRow[]).map((comment) => [comment.id, comment]));
  const messagesByReport = new Map<string, ReportMessage[]>();

  messages.forEach((message) => {
    const key = `${message.report_type}:${message.report_id}`;
    const currentMessages = messagesByReport.get(key) ?? [];
    currentMessages.push({
      id: message.id,
      message: message.message,
      senderName: getUserName(message.sender_user_id),
      recipientName: getUserName(message.recipient_user_id),
      createdAt: message.created_at,
    });
    messagesByReport.set(key, currentMessages);
  });

  const now = Date.now();

  const items: ConciergeReportItem[] = reports.map((report) => {
    const targetTypeValue = getTargetType(report.target_type);
    const status = getStatus(report.status);
    const site = report.site_id ? siteById.get(report.site_id) : null;
    const board = report.board_id ? boardById.get(report.board_id) : null;
    const comment = report.comment_id ? commentById.get(report.comment_id) : null;
    const postId = report.post_id ?? comment?.post_id ?? null;
    const post = postId ? postById.get(postId) : null;
    const isPending = status === 'received' || status === 'reviewing';
    const createdAtTime = new Date(report.created_at).getTime();
    const elapsedMilliseconds = Number.isFinite(createdAtTime) ? now - createdAtTime : 0;
    const hasThreeDaysPassed = elapsedMilliseconds >= 3 * 24 * 60 * 60 * 1000;
    const hasThirtyDaysPassed = elapsedMilliseconds >= 30 * 24 * 60 * 60 * 1000;
    const isContentTarget = targetTypeValue === 'post' || targetTypeValue === 'comment';
    const subscription = site ? (latestSubscriptionBySiteId.get(site.id) ?? null) : null;
    const isPlanTerminated =
      !subscription ||
      subscription.status === 'canceled' ||
      subscription.status === 'expired' ||
      subscription.status === 'scheduled_cancel' ||
      Boolean(subscription.canceled_at && !subscription.next_billing_at);

    return {
      id: report.id,
      reportType: report.reportType,
      reportTypeLabel: conciergeReportTypeLabels[report.reportType],
      targetType: targetTypeValue,
      targetTypeLabel: targetTypeValue ? conciergeTargetTypeLabels[targetTypeValue] : '기타 신고',
      reporterUserId: report.reporter_user_id,
      reporterName: getUserName(report.reporter_user_id),
      reportName: getReportName(report, targetTypeValue),
      reportUrl: normalizeText(report.report_url) || null,
      messageCount: messagesByReport.get(`${report.reportType}:${report.id}`)?.length ?? 0,
      status,
      statusLabel: reportStatusLabels[status],
      createdAt: report.created_at,
      handledAt: report.handled_at,
      site: site
        ? {
            id: site.id,
            name: site.site_label || site.site_key,
            href: `/${site.site_key}`,
            isBlocked: site.is_blocked === true,
            isPlanTerminated,
          }
        : null,
      board:
        site && board
          ? {
              id: board.id,
              name: board.board_label || board.board_key,
              href: `/${site.site_key}/${board.board_key}`,
            }
          : null,
      post:
        site && board && post
          ? {
              id: post.id,
              title: post.subject || '제목 없음',
              href: `/${site.site_key}/${board.board_key}/${post.slug}`,
            }
          : null,
      comment: comment
        ? {
            id: comment.id,
            content: comment.content ?? '',
          }
        : null,
      details: getDetails(report, targetTypeValue),
      messages: messagesByReport.get(`${report.reportType}:${report.id}`) ?? [],
      canDismiss: isPending && isContentTarget && (report.reportType !== 'rights' || !hasThirtyDaysPassed),
      canComplete:
        isPending &&
        isContentTarget &&
        (report.reportType === 'legal' || (report.reportType === 'guideline' && hasThreeDaysPassed)),
      canSendMessage: targetTypeValue === 'site' || targetTypeValue === 'board',
    };
  });

  return { items, total };
}
