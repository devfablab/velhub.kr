import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
    contentId: string;
  }>;
};

function isNumericSlug(value: string) {
  return /^\d+$/.test(value);
}

async function getDisplayNameByUserId(
  siteId: string,
  userId: string,
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
) {
  const nicknameResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('nickname')
    .eq('site_id', siteId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!nicknameResult.error && nicknameResult.data?.nickname) {
    return nicknameResult.data.nickname as string;
  }

  const stigmaResult = await supabaseAdmin.from('stigmas').select('user_name').eq('user_id', userId).maybeSingle();

  if (!stigmaResult.error && stigmaResult.data?.user_name) {
    return decrypt(stigmaResult.data.user_name as string);
  }

  return '';
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { boardName, contentId } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();
    const normalizedContentId = normalizeText(contentId);

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!normalizedContentId) {
      return Response.json({ error: 'contentId가 유효하지 않습니다.' }, { status: 400 });
    }

    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin
      .from('rhizomes')
      .select('id, visibility_type, is_shutdown')
      .eq('site_key', siteName)
      .maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    const isStaff = session.status !== 'FAIL' && session.case === 'staff';
    const sessionUserId = session.status !== 'FAIL' ? session.authUserId : null;

    if (rhizome.data.visibility_type !== 'public' || rhizome.data.is_shutdown !== false) {
      if (!isStaff) {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    const board = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_label, board_type, markdown_status, site_id')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (board.data.board_type === 'page') {
      const pageQuery = supabaseAdmin.from('pages').select('*').eq('board_id', board.data.id);

      const page = await pageQuery.eq('slug', normalizedContentId).maybeSingle();

      if (page.error || !page.data) {
        return Response.json({ error: '페이지를 찾을 수 없습니다.' }, { status: 404 });
      }

      const authorName = page.data.user_id
        ? await getDisplayNameByUserId(rhizome.data.id as string, page.data.user_id as string, supabaseAdmin)
        : '';

      return Response.json({
        board: board.data,
        content: {
          ...page.data,
          slug: String(page.data.slug),
          author_name: authorName,
        },
        isAuthor: sessionUserId === page.data.user_id,
        isStaff,
      });
    }

    const postQuery = supabaseAdmin.from('posts').select('*').eq('board_id', board.data.id);

    const post = isNumericSlug(normalizedContentId)
      ? await postQuery.eq('slug', Number(normalizedContentId)).maybeSingle()
      : await postQuery.eq('id', normalizedContentId).maybeSingle();

    if (post.error || !post.data) {
      return Response.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (post.data.is_closed === true && !isStaff) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const authorName = post.data.user_id
      ? await getDisplayNameByUserId(rhizome.data.id as string, post.data.user_id as string, supabaseAdmin)
      : '';

    const closedByName =
      post.data.closed_by && typeof post.data.closed_by === 'string'
        ? await getDisplayNameByUserId(rhizome.data.id as string, post.data.closed_by as string, supabaseAdmin)
        : '';

    return Response.json({
      board: board.data,
      content: {
        ...post.data,
        slug: String(post.data.slug),
        author_name: authorName,
        closed_by_name: closedByName,
      },
      isAuthor: sessionUserId === post.data.user_id,
      isStaff,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '게시글 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '게시글 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
