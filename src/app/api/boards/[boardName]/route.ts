import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption/decrypt';

type RouteContext = {
  params: Promise<{
    boardName: string;
  }>;
};

type BlogPostRow = {
  id: string;
  slug: number;
  subject: string;
  summary: string | null;
  edited_at: string;
  thumbnail_image: string | null;
  thumbnail_width: number | null;
  thumbnail_height: number | null;
  idx: number;
  user_id: string;
  site_id: string;
  board_id: string;
  created_at: string;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { boardName } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
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

    const isPublicReadable = rhizome.data.visibility_type === 'public' && rhizome.data.is_shutdown === false;

    if (!isPublicReadable) {
      const session = await verifySession({
        siteId: rhizome.data.id,
      });

      if (session.status === 'FAIL') {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }

      if (session.case !== 'staff') {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    const board = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_label, board_type, is_active, sort_order, markdown_status, site_id')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (board.data.board_type === 'page') {
      const pages = await supabaseAdmin
        .from('pages')
        .select('id, slug, subject, summary, edited_at, sort_order, user_id, site_id, board_id')
        .eq('board_id', board.data.id)
        .order('sort_order', { ascending: true });

      if (pages.error) {
        return Response.json({ error: '페이지 목록을 불러오지 못했습니다.' }, { status: 500 });
      }

      return Response.json({
        board: board.data,
        contents: pages.data ?? [],
      });
    }

    if (board.data.board_type === 'blog') {
      const posts = await supabaseAdmin
        .from('posts')
        .select(
          'id, slug, subject, summary, edited_at, thumbnail_image, thumbnail_width, thumbnail_height, idx, user_id, site_id, board_id, created_at',
        )
        .eq('board_id', board.data.id)
        .order('created_at', { ascending: false });

      if (posts.error) {
        return Response.json({ error: '블로그 글 목록을 불러오지 못했습니다.' }, { status: 500 });
      }

      const blogPosts = (posts.data ?? []) as BlogPostRow[];
      const userIdList = Array.from(new Set(blogPosts.map((post) => post.user_id).filter(Boolean)));

      let nicknameMap = new Map<string, string>();
      let userNameMap = new Map<string, string>();

      if (userIdList.length > 0) {
        const nicknameList = await supabaseAdmin
          .from('rhizome_stigmas')
          .select('user_id, nickname')
          .eq('site_id', rhizome.data.id)
          .in('user_id', userIdList);

        if (!nicknameList.error) {
          nicknameMap = new Map(
            (nicknameList.data ?? [])
              .filter((item) => item.user_id)
              .map((item) => [item.user_id as string, (item.nickname as string | null) ?? '']),
          );
        }

        const stigmaList = await supabaseAdmin.from('stigmas').select('user_id, user_name').in('user_id', userIdList);

        if (!stigmaList.error) {
          userNameMap = new Map(
            (stigmaList.data ?? [])
              .filter((item) => item.user_id)
              .map((item) => {
                const encryptedUserName = (item.user_name as string | null) ?? '';
                return [item.user_id as string, encryptedUserName ? decrypt(encryptedUserName) : ''];
              }),
          );
        }
      }

      return Response.json({
        board: board.data,
        contents: blogPosts.map((post) => ({
          ...post,
          slug: String(post.slug),
          author_name: nicknameMap.get(post.user_id) || userNameMap.get(post.user_id) || '',
        })),
      });
    }

    return Response.json({
      board: board.data,
      contents: [],
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '게시판 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '게시판 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
