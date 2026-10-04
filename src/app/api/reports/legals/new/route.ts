import { randomUUID } from 'crypto';
import { NOTIFICATION_TYPE } from '@/lib/notifications/types';
import { isReportTargetType, type ReportTargetType } from '@/lib/reports/guidelines';
import { getSessionClaims } from '@/lib/session';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type LegalType = 'illegal_info' | 'illegal_filming' | 'privacy';

type SiteRow = {
  id: string;
};

type BoardRow = {
  id: string;
};

type PostRow = {
  id: string;
};

type CommentRow = {
  id: string;
  post_id: string;
};

type TargetValues = {
  targetType: ReportTargetType | null;
  targetId: string | null;
  siteId: string | null;
  boardId: string | null;
  postId: string | null;
  commentId: string | null;
  blogCommunityPostId: string | null;
  blogCommunityCommentId: string | null;
};

type UploadedAttachment = {
  bucket: 'report-legals';
  path: string;
  name: string;
  type: string;
  size: number;
};

async function notifyReportReceived({ siteId, reporterId, boardId, postId }: { siteId: string | null; reporterId: string; boardId: string | null; postId: string | null }) {
  if (!siteId) return;
  const supabaseAdmin = getSupabaseAdmin();
  const ownersResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('user_id')
    .eq('site_id', siteId)
    .eq('role', 'owner')
    .eq('is_approval', true)
    .eq('is_block', false);
  if (ownersResult.error || !ownersResult.data?.length) return;
  const recipientIds = [...new Set(ownersResult.data.map((owner) => owner.user_id).filter(Boolean))];
  const result = await supabaseAdmin.from('notifications').insert(recipientIds.map((user_id) => ({
    user_id,
    send_user_id: reporterId,
    send_site_id: siteId,
    send_board_id: boardId,
    send_series_id: null,
    send_post_id: postId,
    notification_type: NOTIFICATION_TYPE.REPORT_RECEIVED,
    is_read: false,
  })));
  if (result.error) console.error('[reports/legals/new] notification error', result.error);
}

function validationError(fieldErrors: Record<string, string>) {
  const errors = [...new Set(Object.values(fieldErrors).filter(Boolean))];
  return Response.json({ error: errors[0] ?? '입력 정보를 확인해 주세요.', errors, fieldErrors }, { status: 400 });
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const legalTypes = ['illegal_info', 'illegal_filming', 'privacy'] as const;

const illegalInfoRequestTypes = ['illegal_info', 'false_manipulated_info'] as const;

const illegalInfoCategories = [
  'obscene_distribution',
  'false_fact_defamation',
  'hate_speech',
  'fear_anxiety_repeated_message',
  'system_damage_disruption',
  'youth_harmful_media_violation',
  'illegal_gambling',
  'personal_info_illegal_trade',
  'weapons_explosives_manufacturing',
  'drug_use_manufacture_trade',
  'national_secret_leak',
  'national_security_law_violation',
  'other_criminal_purpose_aiding',
] as const;

const falseManipulatedInfoCategories = ['false_information', 'manipulated_information'] as const;

const filmingRequestTypes = ['distribution_report', 'deletion_request'] as const;

const filmingReasonTypes = ['illegal_filming', 'deepfake', 'child_youth_sexual_exploitation'] as const;

const privacyReportTypes = ['post', 'comment', 'other'] as const;

const maxPdfFileSize = 10 * 1024 * 1024;

function isLegalType(value: unknown): value is LegalType {
  return typeof value === 'string' && legalTypes.includes(value as LegalType);
}

function getFormStringValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== 'string') {
    return null;
  }

  return value.trim() || null;
}

function getFormBooleanValue(formData: FormData, key: string) {
  return formData.get(key) === 'true';
}

function getFormStringArray(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
}

function getPostSlugValue(value: string | null) {
  return value?.trim() || null;
}

function getFiles(formData: FormData) {
  return formData.getAll('files').filter((value): value is File => value instanceof File && value.size > 0);
}

function validateFiles(files: File[]) {
  if (files.length === 0) {
    return '파일을 첨부해 주세요.';
  }

  if (files.length > 2) {
    return '파일은 최대 2개까지 첨부할 수 있습니다.';
  }

  const invalidFile = files.find(
    (file) => file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf'),
  );

  if (invalidFile) {
    return 'PDF 파일만 첨부할 수 있습니다.';
  }

  const oversizedFile = files.find((file) => file.size > maxPdfFileSize);

  if (oversizedFile) {
    return 'PDF 파일은 1개당 10MB 이하만 첨부할 수 있습니다.';
  }

  return '';
}

function isIncludedArray<T extends readonly string[]>(values: string[], allowedValues: T) {
  return values.every((value) => allowedValues.includes(value));
}

function inferTargetType({
  targetTypeValue,
  siteName,
  boardName,
  contentId,
  commentId,
}: {
  targetTypeValue: string | null;
  siteName: string | null;
  boardName: string | null;
  contentId: string | null;
  commentId: string | null;
}): ReportTargetType | null {
  if (isReportTargetType(targetTypeValue)) {
    return targetTypeValue;
  }

  if (!siteName) {
    return null;
  }

  if (commentId) {
    return 'comment';
  }

  if (contentId) {
    return 'post';
  }

  if (boardName) {
    return 'board';
  }

  return 'site';
}

async function getSiteId(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const result = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

  if (result.error) {
    console.error('[reports/legals/new] getSiteId error', result.error);
    return null;
  }

  return (result.data as SiteRow | null)?.id ?? null;
}

async function getBoardId(siteId: string, boardName: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const result = await supabaseAdmin
    .from('boards')
    .select('id')
    .eq('site_id', siteId)
    .eq('board_key', boardName)
    .maybeSingle();

  if (result.error) {
    console.error('[reports/legals/new] getBoardId error', result.error);
    return null;
  }

  return (result.data as BoardRow | null)?.id ?? null;
}

async function getPostId(siteId: string, boardId: string, contentId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const result = await supabaseAdmin
    .from('posts')
    .select('id')
    .eq('site_id', siteId)
    .eq('board_id', boardId)
    .eq('slug', contentId)
    .maybeSingle();

  if (result.error) {
    console.error('[reports/legals/new] getPostId error', result.error);
    return null;
  }

  return (result.data as PostRow | null)?.id ?? null;
}

async function getComment(siteId: string, boardId: string, commentId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const result = await supabaseAdmin
    .from('post_comments')
    .select('id, post_id')
    .eq('site_id', siteId)
    .eq('board_id', boardId)
    .eq('id', commentId)
    .maybeSingle();

  if (result.error) {
    console.error('[reports/legals/new] getComment error', result.error);
    return null;
  }

  return result.data as CommentRow | null;
}

async function resolveTargetValues({
  targetType,
  siteName,
  boardName,
  contentId,
  commentId,
}: {
  targetType: ReportTargetType | null;
  siteName: string | null;
  boardName: string | null;
  contentId: string | null;
  commentId: string | null;
}): Promise<TargetValues | { error: string; status: number }> {
  if (!targetType) {
    return {
      targetType: null,
      targetId: null,
      siteId: null,
      boardId: null,
      postId: null,
      commentId: null,
      blogCommunityPostId: null,
      blogCommunityCommentId: null,
    };
  }

  if (!siteName) {
    return { error: '사이트 정보가 없습니다.', status: 400 };
  }

  const siteId = await getSiteId(siteName);

  if (!siteId) {
    return { error: '사이트를 찾을 수 없습니다.', status: 404 };
  }

  if (targetType === 'site') {
    return {
      targetType,
      targetId: siteId,
      siteId,
      boardId: null,
      postId: null,
      commentId: null,
      blogCommunityPostId: null,
      blogCommunityCommentId: null,
    };
  }

  if (targetType === 'blog_community_post' || targetType === 'blog_community_comment') {
    if (!contentId) {
      return { error: '게시물 정보가 없습니다.', status: 400 };
    }

    const supabaseAdmin = getSupabaseAdmin();
    const postResult = await supabaseAdmin
      .from('blog_community_posts')
      .select('id')
      .eq('site_id', siteId)
      .eq('slug', contentId)
      .maybeSingle();
    if (postResult.error || !postResult.data) {
      return { error: '게시물을 찾을 수 없습니다.', status: 404 };
    }

    if (targetType === 'blog_community_post') {
      return {
        targetType,
        targetId: postResult.data.id,
        siteId,
        boardId: null,
        postId: null,
        commentId: null,
        blogCommunityPostId: postResult.data.id,
        blogCommunityCommentId: null,
      };
    }

    if (!commentId) {
      return { error: '댓글 정보가 없습니다.', status: 400 };
    }

    const commentResult = await supabaseAdmin
      .from('blog_community_comments')
      .select('id')
      .eq('id', commentId)
      .eq('site_id', siteId)
      .eq('post_id', postResult.data.id)
      .maybeSingle();
    if (commentResult.error || !commentResult.data) {
      return { error: '댓글을 찾을 수 없습니다.', status: 404 };
    }

    return {
      targetType,
      targetId: commentResult.data.id,
      siteId,
      boardId: null,
      postId: null,
      commentId: null,
      blogCommunityPostId: postResult.data.id,
      blogCommunityCommentId: commentResult.data.id,
    };
  }

  if (!boardName) {
    return { error: '게시판 정보가 없습니다.', status: 400 };
  }

  const boardId = await getBoardId(siteId, boardName);

  if (!boardId) {
    return { error: '게시판을 찾을 수 없습니다.', status: 404 };
  }

  if (targetType === 'board') {
    return {
      targetType,
      targetId: boardId,
      siteId,
      boardId,
      postId: null,
      commentId: null,
      blogCommunityPostId: null,
      blogCommunityCommentId: null,
    };
  }

  if (targetType === 'post') {
    if (contentId === null) {
      return { error: '게시물 정보가 없습니다.', status: 400 };
    }

    const postId = await getPostId(siteId, boardId, contentId);

    if (!postId) {
      return { error: '게시물을 찾을 수 없습니다.', status: 404 };
    }

    return {
      targetType,
      targetId: postId,
      siteId,
      boardId,
      postId,
      commentId: null,
      blogCommunityPostId: null,
      blogCommunityCommentId: null,
    };
  }

  if (!commentId) {
    return { error: '댓글 정보가 없습니다.', status: 400 };
  }

  const comment = await getComment(siteId, boardId, commentId);

  if (!comment) {
    return { error: '댓글을 찾을 수 없습니다.', status: 404 };
  }

  return {
    targetType,
    targetId: comment.id,
    siteId,
    boardId,
    postId: comment.post_id,
      commentId: comment.id,
      blogCommunityPostId: null,
      blogCommunityCommentId: null,
  };
}

function validateIllegalInfo(formData: FormData) {
  const requestType = getFormStringValue(formData, 'requestType');
  const selectedIllegalInfoCategories = getFormStringArray(formData, 'illegalInfoCategories');
  const selectedFalseManipulatedInfoCategories = getFormStringArray(formData, 'falseManipulatedInfoCategories');

  if (!requestType || !illegalInfoRequestTypes.includes(requestType as (typeof illegalInfoRequestTypes)[number])) {
    return '신고 · 요청 구분을 선택해 주세요.';
  }

  if (requestType === 'illegal_info' && selectedIllegalInfoCategories.length === 0) {
    return '불법정보 신고 · 요청 구분을 선택해 주세요.';
  }

  if (requestType === 'false_manipulated_info' && selectedFalseManipulatedInfoCategories.length === 0) {
    return '허위조작정보 신고 · 요청 구분을 선택해 주세요.';
  }

  if (!isIncludedArray(selectedIllegalInfoCategories, illegalInfoCategories)) {
    return '불법정보 신고 · 요청 구분이 올바르지 않습니다.';
  }

  if (!isIncludedArray(selectedFalseManipulatedInfoCategories, falseManipulatedInfoCategories)) {
    return '허위조작정보 신고 · 요청 구분이 올바르지 않습니다.';
  }

  if (!getFormStringValue(formData, 'reportContent')) {
    return '신고 내용을 입력해 주세요.';
  }

  if (!getFormStringValue(formData, 'reportReason')) {
    return '신고 이유를 입력해 주세요.';
  }

  if (!getFormStringValue(formData, 'reportBasis')) {
    return '신고 근거를 입력해 주세요.';
  }

  if (requestType === 'illegal_info' && !getFormBooleanValue(formData, 'illegalInfoConfirmed')) {
    return '불법정보 신고 · 요청 확인이 필요합니다.';
  }

  if (requestType === 'false_manipulated_info' && !getFormBooleanValue(formData, 'falseManipulatedInfoConfirmed')) {
    return '허위조작정보 신고 · 요청 확인이 필요합니다.';
  }

  if (!getFormBooleanValue(formData, 'illegalInfoNoticeConfirmed')) {
    return '불법정보/허위조작정보 신고 유의사항 확인이 필요합니다.';
  }

  return '';
}

function validateIllegalFilming(formData: FormData) {
  const selectedFilmingRequestTypes = getFormStringArray(formData, 'filmingRequestTypes');
  const selectedFilmingReasonTypes = getFormStringArray(formData, 'filmingReasonTypes');

  if (selectedFilmingRequestTypes.length === 0) {
    return '신고 · 요청 구분을 선택해 주세요.';
  }

  if (!isIncludedArray(selectedFilmingRequestTypes, filmingRequestTypes)) {
    return '신고 · 요청 구분이 올바르지 않습니다.';
  }

  if (selectedFilmingReasonTypes.length === 0) {
    return '신고 · 요청 사유를 선택해 주세요.';
  }

  if (!isIncludedArray(selectedFilmingReasonTypes, filmingReasonTypes)) {
    return '신고 · 요청 사유가 올바르지 않습니다.';
  }

  if (!getFormStringValue(formData, 'filmingTarget')) {
    return '신고 · 요청 대상을 입력해 주세요.';
  }

  if (!getFormBooleanValue(formData, 'filmingRequestConfirmed')) {
    return '불법촬영물등 신고 · 요청 확인이 필요합니다.';
  }

  if (!getFormBooleanValue(formData, 'filmingNoticeConfirmed')) {
    return '불법촬영물등 신고 유의사항 확인이 필요합니다.';
  }

  return '';
}

function validatePrivacy(formData: FormData) {
  const privacyReportType = getFormStringValue(formData, 'privacyReportType');

  if (!privacyReportType || !privacyReportTypes.includes(privacyReportType as (typeof privacyReportTypes)[number])) {
    return '신고유형을 선택해 주세요.';
  }

  if (!getFormStringValue(formData, 'exposedInformation')) {
    return '노출된 정보를 입력해 주세요.';
  }

  if (!getFormStringValue(formData, 'privacyRequestReason')) {
    return '요청사유를 입력해 주세요.';
  }

  return '';
}

function validateLegalTypeInputs(legalType: LegalType, formData: FormData) {
  if (legalType === 'illegal_info') {
    return validateIllegalInfo(formData);
  }

  if (legalType === 'illegal_filming') {
    return validateIllegalFilming(formData);
  }

  if (legalType === 'privacy') {
    return validatePrivacy(formData);
  }

  return '신고 유형이 올바르지 않습니다.';
}

async function uploadFiles(reportId: string, files: File[]) {
  const supabaseAdmin = getSupabaseAdmin();
  const uploadedFiles: UploadedAttachment[] = [];

  for (const file of files) {
    const path = `${reportId}/${randomUUID()}.pdf`;
    const arrayBuffer = await file.arrayBuffer();

    const uploadResult = await supabaseAdmin.storage.from('report-legals').upload(path, arrayBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

    if (uploadResult.error) {
      console.error('[reports/legals/new] upload error', uploadResult.error);
      throw new Error('파일 업로드에 실패했습니다.');
    }

    uploadedFiles.push({
      bucket: 'report-legals',
      path,
      name: file.name,
      type: file.type || 'application/pdf',
      size: file.size,
    });
  }

  return uploadedFiles;
}

export async function POST(request: Request) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims?.userId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const currentStigma = await getCurrentStigma();

    if (!currentStigma) {
      return Response.json({ error: '계정 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const formData = await request.formData();

    const legalType = getFormStringValue(formData, 'legalType');
    const targetTypeValue = getFormStringValue(formData, 'targetType');
    const siteName = normalizeText(getFormStringValue(formData, 'siteName')).toLowerCase() || null;
    const boardName = normalizeText(getFormStringValue(formData, 'boardName')).toLowerCase() || null;
    const contentIdValue = getFormStringValue(formData, 'contentId') ?? getFormStringValue(formData, 'slug');
    const contentId = getPostSlugValue(contentIdValue);
    const commentId = getFormStringValue(formData, 'commentId');
    const reportUrl = getFormStringValue(formData, 'reportUrl');

    if (!isLegalType(legalType)) return validationError({ legalType: '신고 유형을 선택해 주세요.' });

    const targetType = inferTargetType({
      targetTypeValue,
      siteName,
      boardName,
      contentId: contentIdValue,
      commentId,
    });

    if (!targetType && !reportUrl) return validationError({ reportUrl: '문제가 있는 링크를 입력해 주세요.' });
    if (!targetType && !isValidUrl(reportUrl ?? ''))
      return validationError({ reportUrl: 'http 또는 https 주소를 입력해 주세요.' });

    if (legalType === 'privacy' && targetType) {
      formData.set(
        'privacyReportType',
        targetType === 'post' || targetType === 'blog_community_post'
          ? 'post'
          : targetType === 'comment' || targetType === 'blog_community_comment'
            ? 'comment'
            : 'other',
      );
    }

    const email = getFormStringValue(formData, 'email');
    const phone = getFormStringValue(formData, 'phone');

    if (!email) return validationError({ email: '이메일을 입력해 주세요.' });
    if (!isValidEmail(email)) return validationError({ email: '이메일 주소를 확인해 주세요.' });

    if (!phone) return validationError({ phone: '휴대폰 또는 전화번호를 입력해 주세요.' });

    const files = getFiles(formData);
    const fileErrorMessage = validateFiles(files);

    if (fileErrorMessage) return validationError({ attachment: fileErrorMessage });

    const typeErrorMessage = validateLegalTypeInputs(legalType, formData);

    if (typeErrorMessage) return validationError({ form: typeErrorMessage });

    const targetValues = await resolveTargetValues({
      targetType,
      siteName,
      boardName,
      contentId,
      commentId,
    });

    if ('error' in targetValues) {
      return Response.json({ error: targetValues.error }, { status: targetValues.status });
    }

    const reportId = randomUUID();
    const attachments = await uploadFiles(reportId, files);
    const supabaseAdmin = getSupabaseAdmin();

    const insertResult = await supabaseAdmin.from('report_legals').insert({
      id: reportId,

      legal_type: legalType,
      target_type: targetValues.targetType,
      target_id: targetValues.targetId,

      site_id: targetValues.siteId,
      board_id: targetValues.boardId,
      post_id: targetValues.postId,
      comment_id: targetValues.commentId,
      blog_community_post_id: targetValues.blogCommunityPostId,
      blog_community_comment_id: targetValues.blogCommunityCommentId,

      reporter_user_id: currentStigma.stigmaId,

      report_url: reportUrl,

      email,
      phone,
      attachments,

      request_type: getFormStringValue(formData, 'requestType'),

      illegal_info_categories: getFormStringArray(formData, 'illegalInfoCategories'),
      false_manipulated_info_categories: getFormStringArray(formData, 'falseManipulatedInfoCategories'),

      report_content: getFormStringValue(formData, 'reportContent'),
      report_reason: getFormStringValue(formData, 'reportReason'),
      report_basis: getFormStringValue(formData, 'reportBasis'),

      illegal_info_confirmed: getFormBooleanValue(formData, 'illegalInfoConfirmed'),
      false_manipulated_info_confirmed: getFormBooleanValue(formData, 'falseManipulatedInfoConfirmed'),
      illegal_info_notice_confirmed: getFormBooleanValue(formData, 'illegalInfoNoticeConfirmed'),

      filming_request_types: getFormStringArray(formData, 'filmingRequestTypes'),
      filming_reason_types: getFormStringArray(formData, 'filmingReasonTypes'),
      filming_target: getFormStringValue(formData, 'filmingTarget'),
      filming_request_confirmed: getFormBooleanValue(formData, 'filmingRequestConfirmed'),
      filming_notice_confirmed: getFormBooleanValue(formData, 'filmingNoticeConfirmed'),

      privacy_report_type: getFormStringValue(formData, 'privacyReportType'),
      exposed_information: getFormStringValue(formData, 'exposedInformation'),
      privacy_request_reason: getFormStringValue(formData, 'privacyRequestReason'),
    });

    if (insertResult.error) {
      console.error('[reports/legals/new] insert error', insertResult.error);
      return Response.json({ error: '신고를 접수하지 못했습니다.' }, { status: 500 });
    }

    await notifyReportReceived({
      siteId: targetValues.siteId,
      reporterId: currentStigma.stigmaId,
      boardId: targetValues.boardId,
      postId: targetValues.postId ?? targetValues.blogCommunityPostId,
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: '신고를 접수하지 못했습니다.' }, { status: 500 });
  }
}
