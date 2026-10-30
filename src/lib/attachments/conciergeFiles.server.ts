import { r2Storage } from '@/lib/r2Storage';

type ConciergeTemporaryFile = {
  fileSize: number;
  mimeType: string;
  storagePath: string;
};

export async function verifyConciergeTemporaryFile({
  bucket,
  file,
  prefix,
}: {
  bucket: string;
  file: ConciergeTemporaryFile;
  prefix: string;
}) {
  if (!file.storagePath.startsWith(prefix)) return '첨부 파일 경로가 올바르지 않습니다.';

  const result = await r2Storage.from(bucket).getObjectMetadata(file.storagePath);

  if (result.error || !result.data || result.data.contentLength === null) {
    return '첨부 파일 업로드를 완료한 뒤 다시 시도해 주세요.';
  }

  if (result.data.contentLength !== file.fileSize || result.data.contentType !== file.mimeType) {
    return '첨부 파일 정보를 확인할 수 없습니다.';
  }

  return '';
}
