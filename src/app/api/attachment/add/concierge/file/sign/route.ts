import { createR2UploadSignature } from '@/lib/clients/r2Storage';
import { getCurrentStigma } from '@/lib/session/utils';
import { normalizeText } from '@/lib/utils';

const uploadPolicies = {
  appeal_opinion: {
    allowedMimeTypes: new Set(['application/pdf']),
    bucket: 'report-appeals',
    maxFileSize: 10 * 1024 * 1024,
  },
  contact_evidence: {
    allowedMimeTypes: new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
    bucket: 'inquiry-attachments',
    maxFileSize: 1024 * 1024,
  },
  family_relation_certificate: {
    allowedMimeTypes: new Set(['application/pdf']),
    bucket: 'family-relation-certificates',
    maxFileSize: 10 * 1024 * 1024,
  },
  legal_report: {
    allowedMimeTypes: new Set(['application/pdf']),
    bucket: 'report-legals',
    maxFileSize: 10 * 1024 * 1024,
  },
  minor_family_relation_certificate: {
    allowedMimeTypes: new Set(['application/pdf']),
    bucket: 'family-relation-certificates',
    maxFileSize: 1024 * 1024,
  },
  rights_report: {
    allowedMimeTypes: new Set(['application/pdf']),
    bucket: 'report-rights',
    maxFileSize: 10 * 1024 * 1024,
  },
} as const;

export type ConciergeUploadPurpose = keyof typeof uploadPolicies;

type UploadRequest = {
  method?: unknown;
  key?: unknown;
  partNumber?: unknown;
  uploadId?: unknown;
};

function getFileName(value: string) {
  return value.split(/[\\/]/).pop() ?? '';
}

function getExtension(value: string) {
  const extension =
    getFileName(value)
      .split('.')
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, '') ?? '';
  return extension || null;
}

function getContentDisposition(fileName: string) {
  return `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function getPolicy(value: unknown) {
  return typeof value === 'string' && value in uploadPolicies ? uploadPolicies[value as ConciergeUploadPurpose] : null;
}

function normalizeUploadRequest(value: UploadRequest) {
  const method = value.method;
  const key = typeof value.key === 'string' ? normalizeText(value.key) : '';
  const uploadId = typeof value.uploadId === 'string' ? normalizeText(value.uploadId) : undefined;
  const partNumber =
    typeof value.partNumber === 'number' && Number.isInteger(value.partNumber) && value.partNumber > 0
      ? value.partNumber
      : undefined;

  if (!key || !['DELETE', 'GET', 'POST', 'PUT'].includes(String(method))) return null;

  return {
    method: method as 'DELETE' | 'GET' | 'POST' | 'PUT',
    key,
    ...(uploadId ? { uploadId } : {}),
    ...(partNumber ? { partNumber } : {}),
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      file?: { name?: unknown; size?: unknown; type?: unknown };
      purpose?: unknown;
      request?: UploadRequest;
    };
    const policy = getPolicy(body.purpose);
    const uploadRequest = normalizeUploadRequest(body.request ?? {});
    const currentStigma = await getCurrentStigma();

    if (!currentStigma) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    if (!policy || !uploadRequest) return Response.json({ error: '업로드 요청이 유효하지 않습니다.' }, { status: 400 });

    const prefix = `temp/concierge/${currentStigma.userId}/${body.purpose}/`;
    const isStartRequest = uploadRequest.method === 'POST' && !uploadRequest.uploadId;

    if (isStartRequest) {
      const name = typeof body.file?.name === 'string' ? getFileName(normalizeText(body.file.name)) : '';
      const size = typeof body.file?.size === 'number' ? body.file.size : 0;
      const type = typeof body.file?.type === 'string' ? body.file.type : '';
      const extension = getExtension(name);

      if (!name || !extension || !policy.allowedMimeTypes.has(type) || size <= 0 || size > policy.maxFileSize) {
        return Response.json({ error: '첨부 파일 정보를 확인해 주세요.' }, { status: 400 });
      }

      const storagePath = `${prefix}${crypto.randomUUID()}.${extension}`;
      const signed = await createR2UploadSignature(policy.bucket, uploadRequest, {
        contentDisposition: getContentDisposition(name),
        contentType: type,
        resolvedKey: storagePath,
      });

      return Response.json(signed);
    }

    if (!uploadRequest.key.startsWith(prefix)) {
      return Response.json({ error: '첨부 파일 경로가 유효하지 않습니다.' }, { status: 400 });
    }

    return Response.json(await createR2UploadSignature(policy.bucket, uploadRequest));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '파일 업로드 준비에 실패했습니다.' },
      { status: 500 },
    );
  }
}
