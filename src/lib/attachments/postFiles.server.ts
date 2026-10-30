import { r2Storage } from '@/lib/r2Storage';
import { normalizeText } from '@/lib/utils';

const POST_BUCKET = 'post';
const MAX_FILE_COUNT = 5;
const MAX_TOTAL_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['7z', 'zip']);

export type PostAttachmentInput = {
  fileName: string;
  fileSize: number;
  storagePath: string;
};

export type StoredPostAttachment = PostAttachmentInput & {
  contentType: string;
};

function getFileName(value: string) {
  return value.split(/[\\/]/).pop() ?? '';
}

function hasAllowedExtension(value: string) {
  const extension = value.split('.').pop()?.toLowerCase() ?? '';

  return ALLOWED_EXTENSIONS.has(extension);
}

export function normalizePostAttachmentInputs(value: unknown): PostAttachmentInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  if (value.length > MAX_FILE_COUNT) {
    throw new Error('첨부 파일은 최대 5개까지 등록할 수 있습니다.');
  }

  const attachmentPaths = new Set<string>();
  const attachments: PostAttachmentInput[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      throw new Error('첨부 파일 정보가 유효하지 않습니다.');
    }

    const row = item as {
      fileName?: unknown;
      fileSize?: unknown;
      storagePath?: unknown;
    };
    const fileName = typeof row.fileName === 'string' ? normalizeText(row.fileName) : '';
    const storagePath = typeof row.storagePath === 'string' ? normalizeText(row.storagePath) : '';
    const fileSize = typeof row.fileSize === 'number' && Number.isFinite(row.fileSize) ? Math.floor(row.fileSize) : 0;

    if (
      !fileName ||
      fileName !== getFileName(fileName) ||
      !hasAllowedExtension(fileName) ||
      !storagePath ||
      !hasAllowedExtension(storagePath) ||
      fileSize <= 0 ||
      attachmentPaths.has(storagePath)
    ) {
      throw new Error('첨부 파일 정보가 유효하지 않습니다.');
    }

    attachmentPaths.add(storagePath);
    attachments.push({ fileName, fileSize, storagePath });
  }

  return attachments;
}

export async function resolvePostAttachments({
  attachments,
  siteId,
  userId,
}: {
  attachments: PostAttachmentInput[];
  siteId: string;
  userId: string;
}): Promise<StoredPostAttachment[]> {
  const expectedPrefix = `attachments/${siteId}/${userId}/`;

  for (const attachment of attachments) {
    if (!attachment.storagePath.startsWith(expectedPrefix)) {
      throw new Error('첨부 파일 경로가 유효하지 않습니다.');
    }
  }

  const resolvedAttachments = await Promise.all(
    attachments.map(async (attachment) => {
      const result = await r2Storage.from(POST_BUCKET).getObjectMetadata(attachment.storagePath);

      if (result.error || !result.data || !result.data.contentLength) {
        throw new Error('첨부 파일을 확인할 수 없습니다.');
      }

      if (result.data.contentLength !== attachment.fileSize) {
        throw new Error('첨부 파일 용량이 일치하지 않습니다.');
      }

      return {
        ...attachment,
        contentType: result.data.contentType || 'application/octet-stream',
      };
    }),
  );
  const totalFileSize = resolvedAttachments.reduce((total, attachment) => total + attachment.fileSize, 0);

  if (totalFileSize > MAX_TOTAL_FILE_SIZE) {
    throw new Error('첨부 파일의 전체 용량은 10MB 이하만 가능합니다.');
  }

  return resolvedAttachments;
}
