import { assertCommunityBoardWritePermission, assertCommunityPostWritePolicy } from '@/lib/community/policies';
import { createR2UploadSignature } from '@/lib/r2Storage';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

const POST_BUCKET = 'post';
const ALLOWED_EXTENSIONS = new Set(['7z', 'zip']);

type UploadRequest = {
  method?: unknown;
  key?: unknown;
  uploadId?: unknown;
  partNumber?: unknown;
};

function getFileName(value: string) {
  return value.split(/[\\/]/).pop() ?? '';
}

function getExtension(value: string) {
  const fileName = getFileName(value);
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';

  return ALLOWED_EXTENSIONS.has(extension) ? extension : '';
}

function getContentDisposition(fileName: string) {
  return `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function normalizeUploadRequest(value: UploadRequest) {
  const method = value.method;
  const key = typeof value.key === 'string' ? normalizeText(value.key) : '';
  const uploadId = typeof value.uploadId === 'string' ? normalizeText(value.uploadId) : undefined;
  const partNumber =
    typeof value.partNumber === 'number' && Number.isInteger(value.partNumber) && value.partNumber > 0
      ? value.partNumber
      : undefined;

  if (!key || !['DELETE', 'GET', 'POST', 'PUT'].includes(String(method))) {
    return null;
  }

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
      boardName?: unknown;
      request?: UploadRequest;
      siteName?: unknown;
    };
    const siteName = typeof body.siteName === 'string' ? normalizeText(body.siteName).toLowerCase() : '';
    const boardName = typeof body.boardName === 'string' ? normalizeText(body.boardName).toLowerCase() : '';
    const uploadRequest = normalizeUploadRequest(body.request ?? {});

    if (!siteName || !boardName || !uploadRequest) {
      return Response.json({ error: '업로드 요청이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const rhizomeResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_type')
      .eq('site_key', siteName)
      .maybeSingle();

    if (rhizomeResult.error || !rhizomeResult.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const boardResult = await supabaseAdmin
      .from('boards')
      .select('id, board_type, site_id')
      .eq('site_id', rhizomeResult.data.id)
      .eq('board_key', boardName)
      .maybeSingle();

    if (boardResult.error) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({ siteId: rhizomeResult.data.id });

    if (!session.authUserId || !session.stigmaId) {
      return Response.json({ error: '로그인 후 파일을 첨부할 수 있습니다.' }, { status: 401 });
    }

    const isFirstBlogPost =
      !boardResult.data &&
      rhizomeResult.data.site_type === 'blog' &&
      boardName === 'b' &&
      (session.case === 'admin' || session.case === 'staff');

    if (!boardResult.data && !isFirstBlogPost) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (boardResult.data && !['basic', 'blog'].includes(boardResult.data.board_type)) {
      return Response.json({ error: '일반 게시판과 블로그 글에만 파일을 첨부할 수 있습니다.' }, { status: 400 });
    }

    if (boardResult.data) {
      await assertCommunityBoardWritePermission({
        siteId: rhizomeResult.data.id,
        boardId: boardResult.data.id,
        stigmaId: session.stigmaId,
        sessionCase: session.case,
      });
      await assertCommunityPostWritePolicy({
        siteId: rhizomeResult.data.id,
        stigmaId: session.stigmaId,
        sessionCase: session.case,
      });
    }

    const attachmentPrefix = `attachments/${rhizomeResult.data.id}/${session.authUserId}/`;
    const isStartRequest = uploadRequest.method === 'POST' && !uploadRequest.uploadId;

    if (isStartRequest) {
      const fileName = getFileName(uploadRequest.key);
      const extension = getExtension(fileName);

      if (!fileName || !extension) {
        return Response.json({ error: '7z, zip 파일만 첨부할 수 있습니다.' }, { status: 400 });
      }

      const storagePath = `${attachmentPrefix}${crypto.randomUUID()}.${extension}`;
      const signed = await createR2UploadSignature(POST_BUCKET, uploadRequest, {
        contentDisposition: getContentDisposition(fileName),
        resolvedKey: storagePath,
      });

      return Response.json(signed);
    }

    if (!uploadRequest.key.startsWith(attachmentPrefix) || !getExtension(uploadRequest.key)) {
      return Response.json({ error: '첨부 파일 경로가 유효하지 않습니다.' }, { status: 400 });
    }

    return Response.json(await createR2UploadSignature(POST_BUCKET, uploadRequest));
  } catch (unknownError) {
    const error = unknownError instanceof Error ? unknownError.message : '파일 업로드 준비에 실패했습니다.';

    return Response.json({ error }, { status: 500 });
  }
}
