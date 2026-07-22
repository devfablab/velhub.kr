import { randomUUID } from 'node:crypto';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { isReportTargetType, type ReportTargetType } from '@/lib/reports/guidelines';

type RightsReportCategory =
  | 'rights_defamation'
  | 'rights_personality_rights'
  | 'rights_copyright'
  | 'rights_trademark'
  | 'rights_counterfeit'
  | 'rights_design_patent_utility';

type RightsReasonType =
  | 'defamation'
  | 'personality_rights'
  | 'copyright'
  | 'trademark'
  | 'counterfeit'
  | 'design_patent_utility';

type RightsOwnerType = 'individual' | 'organization';
type ReporterCapacity = 'direct' | 'proxy';

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
};

type UploadedCopyrightProofFile = {
  bucket: 'report-rights';
  path: string;
  name: string;
  type: string;
  size: number;
};

type UploadedReportFile = UploadedCopyrightProofFile;

const maxCopyrightProofFileSize = 2 * 1024 * 1024;
const maxRightsReportFileSize = 10 * 1024 * 1024;

const rightsReportCategoryToReasonType = {
  rights_defamation: 'defamation',
  rights_personality_rights: 'personality_rights',
  rights_copyright: 'copyright',
  rights_trademark: 'trademark',
  rights_counterfeit: 'counterfeit',
  rights_design_patent_utility: 'design_patent_utility',
} satisfies Record<RightsReportCategory, RightsReasonType>;

const ownerRequiredReasonTypes = ['defamation', 'personality_rights', 'copyright'] as const;
const ownerDetailsReasonTypes = ['defamation', 'personality_rights'] as const;

function isRightsReportCategory(value: unknown): value is RightsReportCategory {
  return (
    value === 'rights_defamation' ||
    value === 'rights_personality_rights' ||
    value === 'rights_copyright' ||
    value === 'rights_trademark' ||
    value === 'rights_counterfeit' ||
    value === 'rights_design_patent_utility'
  );
}

function isRightsReasonType(value: unknown): value is RightsReasonType {
  return (
    value === 'defamation' ||
    value === 'personality_rights' ||
    value === 'copyright' ||
    value === 'trademark' ||
    value === 'counterfeit' ||
    value === 'design_patent_utility'
  );
}

function isRightsOwnerType(value: unknown): value is RightsOwnerType {
  return value === 'individual' || value === 'organization';
}

function isReporterCapacity(value: unknown): value is ReporterCapacity {
  return value === 'direct' || value === 'proxy';
}

function isOwnerRequiredReasonType(value: RightsReasonType) {
  return ownerRequiredReasonTypes.includes(value as (typeof ownerRequiredReasonTypes)[number]);
}

function isOwnerDetailsReasonType(value: RightsReasonType) {
  return ownerDetailsReasonTypes.includes(value as (typeof ownerDetailsReasonTypes)[number]);
}

function getFormStringValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== 'string') {
    return null;
  }

  return value.trim() || null;
}

function getFormStringArray(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
}

function getPostSlugValue(value: string | null) {
  if (!value) {
    return null;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return null;
  }

  return numberValue;
}

function getCopyrightProofFiles(formData: FormData) {
  return formData
    .getAll('copyrightProofFiles')
    .filter((value): value is File => value instanceof File && value.size > 0);
}

function getSingleFormFile(formData: FormData, key: string) {
  const files = formData
    .getAll(key)
    .filter((value): value is File => value instanceof File && value.size > 0);

  return files.length === 1 ? files[0] : null;
}

function getReasonType(formData: FormData): RightsReasonType | null {
  const reportCategory = getFormStringValue(formData, 'reportCategory');

  if (isRightsReportCategory(reportCategory)) {
    return rightsReportCategoryToReasonType[reportCategory];
  }

  const reasonType = getFormStringValue(formData, 'reasonType');

  if (isRightsReasonType(reasonType)) {
    return reasonType;
  }

  return null;
}

function validateCopyrightProofFiles(files: File[]) {
  if (files.length > 5) {
    return '저작물 원본임을 증명할 수 있는 PDF는 최대 5개까지 첨부할 수 있습니다.';
  }

  const invalidFile = files.find(
    (file) => file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf'),
  );

  if (invalidFile) {
    return '저작물 원본임을 증명할 수 있는 파일은 PDF만 첨부할 수 있습니다.';
  }

  const oversizedFile = files.find((file) => file.size > maxCopyrightProofFileSize);

  if (oversizedFile) {
    return '저작물 원본임을 증명할 수 있는 PDF는 1개당 2MB 이하만 첨부할 수 있습니다.';
  }

  return '';
}

function validateRightsReportFile(file: File | null, label: string) {
  if (!file) {
    return `${label}를 첨부해 주세요.`;
  }

  if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
    return `${label}는 PDF 파일만 첨부할 수 있습니다.`;
  }

  if (file.size >= maxRightsReportFileSize) {
    return `${label}는 10MB 미만의 PDF 파일만 첨부할 수 있습니다.`;
  }

  return '';
}

function isDateValue(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
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
    console.error('[reports/rights/new] getSiteId error', result.error);
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
    console.error('[reports/rights/new] getBoardId error', result.error);
    return null;
  }

  return (result.data as BoardRow | null)?.id ?? null;
}

async function getPostId(siteId: string, boardId: string, contentId: number) {
  const supabaseAdmin = getSupabaseAdmin();

  const result = await supabaseAdmin
    .from('posts')
    .select('id')
    .eq('site_id', siteId)
    .eq('board_id', boardId)
    .eq('slug', contentId)
    .maybeSingle();

  if (result.error) {
    console.error('[reports/rights/new] getPostId error', result.error);
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
    console.error('[reports/rights/new] getComment error', result.error);
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
  contentId: number | null;
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
  };
}

async function uploadCopyrightProofFiles(reportId: string, files: File[]) {
  const supabaseAdmin = getSupabaseAdmin();
  const uploadedFiles: UploadedCopyrightProofFile[] = [];

  for (const file of files) {
    const path = `${reportId}/${randomUUID()}.pdf`;
    const arrayBuffer = await file.arrayBuffer();

    const uploadResult = await supabaseAdmin.storage.from('report-rights').upload(path, arrayBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

    if (uploadResult.error) {
      console.error('[reports/rights/new] upload error', uploadResult.error);
      throw new Error('파일 업로드에 실패했습니다.');
    }

    uploadedFiles.push({
      bucket: 'report-rights',
      path,
      name: file.name,
      type: file.type || 'application/pdf',
      size: file.size,
    });
  }

  return uploadedFiles;
}

async function uploadRightsReportFile(reportId: string, directory: string, file: File) {
  const supabaseAdmin = getSupabaseAdmin();
  const path = `${reportId}/${directory}/${randomUUID()}.pdf`;
  const arrayBuffer = await file.arrayBuffer();

  const uploadResult = await supabaseAdmin.storage.from('report-rights').upload(path, arrayBuffer, {
    contentType: 'application/pdf',
    upsert: false,
  });

  if (uploadResult.error) {
    console.error('[reports/rights/new] upload error', uploadResult.error);
    throw new Error('파일 업로드에 실패했습니다.');
  }

  return {
    bucket: 'report-rights',
    path,
    name: file.name,
    type: file.type || 'application/pdf',
    size: file.size,
  } satisfies UploadedReportFile;
}

export async function POST(request: Request) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims?.userId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const formData = await request.formData();

    const reasonType = getReasonType(formData);
    const targetTypeValue = getFormStringValue(formData, 'targetType');
    const siteName = normalizeText(getFormStringValue(formData, 'siteName')).toLowerCase() || null;
    const boardName = normalizeText(getFormStringValue(formData, 'boardName')).toLowerCase() || null;
    const contentIdValue = getFormStringValue(formData, 'contentId') ?? getFormStringValue(formData, 'slug');
    const contentId = getPostSlugValue(contentIdValue);
    const commentId = getFormStringValue(formData, 'commentId');
    const reportUrl = getFormStringValue(formData, 'reportUrl');
    const email = getFormStringValue(formData, 'email');
    const phone = getFormStringValue(formData, 'phone');
    const isSmsValue = getFormStringValue(formData, 'isSms');
    const isSms = isSmsValue === 'true' ? true : isSmsValue === 'false' ? false : null;
    const rightsOwnerTypeValue = getFormStringValue(formData, 'rightsOwnerType');
    const reporterCapacityValue = getFormStringValue(formData, 'reporterCapacity');
    const rightsHolderName = getFormStringValue(formData, 'rightsHolderName');
    const rightsHolderPhone = getFormStringValue(formData, 'rightsHolderPhone');
    const rightsHolderProofFile = getSingleFormFile(formData, 'rightsHolderProofFile');
    const delegationStartedOn = getFormStringValue(formData, 'delegationStartedOn');
    const delegationEndedOn = getFormStringValue(formData, 'delegationEndedOn');
    const powerOfAttorneyFile = getSingleFormFile(formData, 'powerOfAttorneyFile');
    const infringementReason = getFormStringValue(formData, 'infringementReason');
    const infringementEvidenceFile = getSingleFormFile(formData, 'infringementEvidenceFile');
    const copyrightOriginalUrls = getFormStringArray(formData, 'copyrightOriginalUrls');
    const copyrightProofFiles = getCopyrightProofFiles(formData);

    if (!reasonType) {
      return Response.json({ error: '신고 사유를 선택해 주세요.' }, { status: 400 });
    }

    const targetType = inferTargetType({
      targetTypeValue,
      siteName,
      boardName,
      contentId: contentIdValue,
      commentId,
    });

    if (!targetType && !reportUrl) {
      return Response.json({ error: '신고대상 URL을 입력해 주세요.' }, { status: 400 });
    }

    if (!email) {
      return Response.json({ error: '이메일을 입력해 주세요.' }, { status: 400 });
    }

    if (!phone) {
      return Response.json({ error: '전화번호를 입력해 주세요.' }, { status: 400 });
    }

    if (isSms === null) {
      return Response.json({ error: '처리결과 SMS 안내 수신 여부를 선택해 주세요.' }, { status: 400 });
    }

    if (isOwnerRequiredReasonType(reasonType) && !isRightsOwnerType(rightsOwnerTypeValue)) {
      return Response.json({ error: '권리 소유자를 선택해 주세요.' }, { status: 400 });
    }

    const rightsOwnerType = isRightsOwnerType(rightsOwnerTypeValue) ? rightsOwnerTypeValue : null;
    const reporterCapacity = isReporterCapacity(reporterCapacityValue) ? reporterCapacityValue : null;
    const usesOwnerDetails = isOwnerDetailsReasonType(reasonType);

    if (usesOwnerDetails && !reporterCapacity) {
      return Response.json({ error: '신고자와 권리 소유자의 관계를 선택해 주세요.' }, { status: 400 });
    }

    const requiresRightsHolderDetails =
      usesOwnerDetails &&
      (rightsOwnerType === 'organization' || (rightsOwnerType === 'individual' && reporterCapacity === 'proxy'));

    if (requiresRightsHolderDetails && !rightsHolderName) {
      return Response.json(
        { error: rightsOwnerType === 'organization' ? '피해단체 이름을 입력해 주세요.' : '피해자 이름을 입력해 주세요.' },
        { status: 400 },
      );
    }

    if (requiresRightsHolderDetails && !rightsHolderPhone) {
      return Response.json(
        {
          error:
            rightsOwnerType === 'organization'
              ? '피해단체 전화번호를 입력해 주세요.'
              : '피해자 전화번호를 입력해 주세요.',
        },
        { status: 400 },
      );
    }

    if (requiresRightsHolderDetails) {
      const proofFileError = validateRightsReportFile(
        rightsHolderProofFile,
        rightsOwnerType === 'organization' ? '단체 증빙서류' : '피해자 신분증',
      );

      if (proofFileError) {
        return Response.json({ error: proofFileError }, { status: 400 });
      }
    }

    if (usesOwnerDetails && reporterCapacity === 'proxy') {
      if (!isDateValue(delegationStartedOn) || !isDateValue(delegationEndedOn)) {
        return Response.json({ error: '위임 기간을 입력해 주세요.' }, { status: 400 });
      }

      if (delegationStartedOn! > delegationEndedOn!) {
        return Response.json({ error: '위임 종료일은 시작일보다 빠를 수 없습니다.' }, { status: 400 });
      }

      const attorneyFileError = validateRightsReportFile(powerOfAttorneyFile, '위임장');

      if (attorneyFileError) {
        return Response.json({ error: attorneyFileError }, { status: 400 });
      }
    }

    if (usesOwnerDetails && !infringementReason) {
      return Response.json({ error: '권리침해 내용 및 신고 사유를 입력해 주세요.' }, { status: 400 });
    }

    const evidenceFileError = usesOwnerDetails
      ? validateRightsReportFile(infringementEvidenceFile, '권리침해 증빙자료')
      : '';

    if (evidenceFileError) {
      return Response.json({ error: evidenceFileError }, { status: 400 });
    }

    if (copyrightOriginalUrls.length > 10) {
      return Response.json({ error: '저작물 원본 URL은 최대 10개까지 입력할 수 있습니다.' }, { status: 400 });
    }

    const fileErrorMessage = validateCopyrightProofFiles(copyrightProofFiles);

    if (fileErrorMessage) {
      return Response.json({ error: fileErrorMessage }, { status: 400 });
    }

    if (reasonType === 'copyright' && copyrightOriginalUrls.length === 0 && copyrightProofFiles.length === 0) {
      return Response.json(
        { error: '저작물 원본 URL 또는 저작물 원본임을 증명할 수 있는 PDF 중 하나는 입력해 주세요.' },
        { status: 400 },
      );
    }

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
    const uploadedCopyrightProofFiles = await uploadCopyrightProofFiles(reportId, copyrightProofFiles);
    const supabaseAdmin = getSupabaseAdmin();
    const uploadedReportFiles: UploadedReportFile[] = [];
    let uploadedRightsHolderProofFile: UploadedReportFile | null = null;
    let uploadedPowerOfAttorneyFile: UploadedReportFile | null = null;
    let uploadedInfringementEvidenceFile: UploadedReportFile | null = null;

    try {
      if (requiresRightsHolderDetails && rightsHolderProofFile) {
        uploadedRightsHolderProofFile = await uploadRightsReportFile(reportId, 'rights-holder', rightsHolderProofFile);
        uploadedReportFiles.push(uploadedRightsHolderProofFile);
      }

      if (usesOwnerDetails && reporterCapacity === 'proxy' && powerOfAttorneyFile) {
        uploadedPowerOfAttorneyFile = await uploadRightsReportFile(
          reportId,
          'power-of-attorney',
          powerOfAttorneyFile,
        );
        uploadedReportFiles.push(uploadedPowerOfAttorneyFile);
      }

      if (usesOwnerDetails && infringementEvidenceFile) {
        uploadedInfringementEvidenceFile = await uploadRightsReportFile(
          reportId,
          'infringement-evidence',
          infringementEvidenceFile,
        );
        uploadedReportFiles.push(uploadedInfringementEvidenceFile);
      }
    } catch (uploadError) {
      if (uploadedReportFiles.length > 0) {
        await supabaseAdmin.storage.from('report-rights').remove(uploadedReportFiles.map((file) => file.path));
      }

      throw uploadError;
    }

    const insertResult = await supabaseAdmin
      .from('report_rights')
      .insert({
        id: reportId,

        target_type: targetValues.targetType,
        target_id: targetValues.targetId,

        site_id: targetValues.siteId,
        board_id: targetValues.boardId,
        post_id: targetValues.postId,
        comment_id: targetValues.commentId,

        report_url: reportUrl,
        reporter_user_id: sessionClaims.userId,

        email,
        phone,
        is_sms: isSms,

        reason_type: reasonType,
        rights_owner_type: isRightsOwnerType(rightsOwnerTypeValue) ? rightsOwnerTypeValue : null,
        ...(usesOwnerDetails
          ? {
              reporter_capacity: reporterCapacity,
              rights_holder_name: requiresRightsHolderDetails ? rightsHolderName : null,
              rights_holder_phone: requiresRightsHolderDetails ? rightsHolderPhone : null,
              rights_holder_proof_file: uploadedRightsHolderProofFile,
              delegation_started_on: reporterCapacity === 'proxy' ? delegationStartedOn : null,
              delegation_ended_on: reporterCapacity === 'proxy' ? delegationEndedOn : null,
              power_of_attorney_file: uploadedPowerOfAttorneyFile,
              infringement_reason: infringementReason,
              infringement_evidence_file: uploadedInfringementEvidenceFile,
            }
          : {}),

        copyright_original_urls: copyrightOriginalUrls.length > 0 ? copyrightOriginalUrls : null,
        copyright_proof_files: uploadedCopyrightProofFiles.length > 0 ? uploadedCopyrightProofFiles : null,
      })
      .select('id')
      .single();

    if (insertResult.error) {
      console.error('[reports/rights/new] insert error', insertResult.error);

      if (uploadedReportFiles.length > 0) {
        await supabaseAdmin.storage.from('report-rights').remove(uploadedReportFiles.map((file) => file.path));
      }

      return Response.json({ error: '신고를 접수하지 못했습니다.' }, { status: 500 });
    }

    const now = new Date().toISOString();
    const contentUpdateResult =
      targetValues.targetType === 'post' && targetValues.postId
        ? await supabaseAdmin
            .from('posts')
            .update({
              is_closed: true,
              is_locked: true,
              closed_message: '권리침해 위반',
              closed_by: sessionClaims.userId,
              closed_at: now,
            })
            .eq('id', targetValues.postId)
        : targetValues.targetType === 'comment' && targetValues.commentId
          ? await supabaseAdmin
              .from('post_comments')
              .update({
                is_deleted: true,
                is_locked: true,
                deleted_message: '권리침해 위반',
                deleted_by: sessionClaims.userId,
                deleted_at: now,
              })
              .eq('id', targetValues.commentId)
          : null;

    if (contentUpdateResult?.error) {
      console.error('[reports/rights/new] content hide error', contentUpdateResult.error);
      await supabaseAdmin.from('report_rights').delete().eq('id', reportId);

      if (uploadedCopyrightProofFiles.length > 0) {
        await supabaseAdmin.storage.from('report-rights').remove(uploadedCopyrightProofFiles.map((file) => file.path));
      }

      if (uploadedReportFiles.length > 0) {
        await supabaseAdmin.storage.from('report-rights').remove(uploadedReportFiles.map((file) => file.path));
      }

      return Response.json({ error: '신고 대상을 숨김 처리하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (unknownError) {
    console.error('[reports/rights/new] unexpected error', unknownError);

    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '신고를 접수하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '신고를 접수하지 못했습니다.' }, { status: 500 });
  }
}
