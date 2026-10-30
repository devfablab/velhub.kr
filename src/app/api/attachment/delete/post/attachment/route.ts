import { assertCommunityBoardWritePermission, assertCommunityPostWritePolicy } from '@/lib/community/policies';
import { r2Storage } from '@/lib/r2Storage';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

const POST_BUCKET = 'post';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      boardName?: unknown;
      path?: unknown;
      siteName?: unknown;
    };
    const boardName = typeof body.boardName === 'string' ? normalizeText(body.boardName).toLowerCase() : '';
    const siteName = typeof body.siteName === 'string' ? normalizeText(body.siteName).toLowerCase() : '';
    const path = typeof body.path === 'string' ? normalizeText(body.path) : '';

    if (!siteName || !boardName || !path) {
      return Response.json({ error: '첨부 파일 정보가 유효하지 않습니다.' }, { status: 400 });
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
      .select('id, board_type')
      .eq('site_id', rhizomeResult.data.id)
      .eq('board_key', boardName)
      .maybeSingle();

    if (boardResult.error) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({ siteId: rhizomeResult.data.id });

    if (!session.authUserId || !session.stigmaId) {
      return Response.json({ error: '로그인 후 파일을 삭제할 수 있습니다.' }, { status: 401 });
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

    const expectedPrefix = `attachments/${rhizomeResult.data.id}/${session.authUserId}/`;

    if (!path.startsWith(expectedPrefix)) {
      return Response.json({ error: '첨부 파일 경로가 유효하지 않습니다.' }, { status: 400 });
    }

    const result = await r2Storage.from(POST_BUCKET).remove([path]);

    if (result.error) {
      return Response.json({ error: '첨부 파일을 삭제하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (unknownError) {
    const error = unknownError instanceof Error ? unknownError.message : '첨부 파일을 삭제하지 못했습니다.';

    return Response.json({ error }, { status: 500 });
  }
}
