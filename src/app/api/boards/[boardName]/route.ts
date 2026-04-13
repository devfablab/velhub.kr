import { getSessionClaims } from '@/lib/session';
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

type AccessResult = {
  ok: boolean;
  status: number;
  error?: string;
  siteId?: string;
};

async function checkReadAccess(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const rhizomeResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, visibility_type, is_shutdown')
    .eq('site_key', siteName)
    .maybeSingle();

  if (rhizomeResult.error || !rhizomeResult.data) {
    return {
      ok: false,
      status: 404,
      error: '사이트를 찾을 수 없습니다.',
    } satisfies AccessResult;
  }

  const rhizome = rhizomeResult.data;
  const sessionClaims = await getSessionClaims();

  if (rhizome.is_shutdown) {
    if (!sessionClaims) {
      return {
        ok: false,
        status: 401,
        error: '로그인이 필요합니다.',
      } satisfies AccessResult;
    }

    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('id')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigmaResult.error || !stigmaResult.data) {
      return {
        ok: false,
        status: 500,
        error: '사용자 정보를 확인하지 못했습니다.',
      } satisfies AccessResult;
    }

    const manageResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('role')
      .eq('site_id', rhizome.id)
      .eq('user_id', stigmaResult.data.id)
      .in('role', ['owner', 'manager'])
      .maybeSingle();

    if (manageResult.error || !manageResult.data) {
      return {
        ok: false,
        status: 403,
        error: '접근 권한이 없습니다.',
      } satisfies AccessResult;
    }

    return {
      ok: true,
      status: 200,
      siteId: rhizome.id,
    } satisfies AccessResult;
  }

  if (rhizome.visibility_type === 'public') {
    return {
      ok: true,
      status: 200,
      siteId: rhizome.id,
    } satisfies AccessResult;
  }

  if (!sessionClaims) {
    return {
      ok: false,
      status: 401,
      error: '로그인이 필요합니다.',
    } satisfies AccessResult;
  }

  const stigmaResult = await supabaseAdmin
    .from('stigmas')
    .select('id')
    .eq('user_id', sessionClaims.userId)
    .maybeSingle();

  if (stigmaResult.error || !stigmaResult.data) {
    return {
      ok: false,
      status: 500,
      error: '사용자 정보를 확인하지 못했습니다.',
    } satisfies AccessResult;
  }

  const accessResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('id')
    .eq('site_id', rhizome.id)
    .eq('user_id', stigmaResult.data.id)
    .eq('is_approval', true)
    .eq('is_block', false)
    .maybeSingle();

  if (accessResult.error || !accessResult.data) {
    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } satisfies AccessResult;
  }

  return {
    ok: true,
    status: 200,
    siteId: rhizome.id,
  } satisfies AccessResult;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { boardName } = await context.params;
    const normalizedBoardName = boardName.trim().toLowerCase();

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    const requestUrl = new URL(request.url);
    const siteName = requestUrl.searchParams.get('siteName')?.trim().toLowerCase() ?? '';

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const accessResult = await checkReadAccess(siteName);

    if (!accessResult.ok || !accessResult.siteId) {
      return Response.json({ error: accessResult.error }, { status: accessResult.status });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const boardResult = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_label, board_type, is_active, sort_order, markdown_status, site_id')
      .eq('site_id', accessResult.siteId)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (boardResult.error || !boardResult.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (boardResult.data.board_type === 'page') {
      const pagesResult = await supabaseAdmin
        .from('pages')
        .select('id, slug, subject, summary, edited_at, sort_order, user_id, site_id, board_id')
        .eq('board_id', boardResult.data.id)
        .order('sort_order', { ascending: true });

      if (pagesResult.error) {
        return Response.json({ error: '페이지 목록을 불러오지 못했습니다.' }, { status: 500 });
      }

      return Response.json({
        board: boardResult.data,
        contents: pagesResult.data ?? [],
      });
    }

    if (boardResult.data.board_type === 'blog') {
      const postsResult = await supabaseAdmin
        .from('posts')
        .select(
          'id, slug, subject, summary, edited_at, thumbnail_image, thumbnail_width, thumbnail_height, idx, user_id, site_id, board_id, created_at',
        )
        .eq('board_id', boardResult.data.id)
        .order('created_at', { ascending: false });

      if (postsResult.error) {
        return Response.json({ error: '블로그 글 목록을 불러오지 못했습니다.' }, { status: 500 });
      }

      const posts = (postsResult.data ?? []) as BlogPostRow[];
      const userIdList = Array.from(new Set(posts.map((post) => post.user_id).filter(Boolean)));

      let nicknameMap = new Map<string, string>();
      let userNameMap = new Map<string, string>();

      if (userIdList.length > 0) {
        const nicknameListResult = await supabaseAdmin
          .from('rhizome_stigmas')
          .select('user_id, nickname')
          .eq('site_id', accessResult.siteId)
          .in('user_id', userIdList);

        if (!nicknameListResult.error) {
          nicknameMap = new Map(
            (nicknameListResult.data ?? [])
              .filter((item) => item.user_id)
              .map((item) => [item.user_id as string, (item.nickname as string | null) ?? '']),
          );
        }

        const stigmaListResult = await supabaseAdmin
          .from('stigmas')
          .select('user_id, user_name')
          .in('user_id', userIdList);

        if (!stigmaListResult.error) {
          userNameMap = new Map(
            (stigmaListResult.data ?? [])
              .filter((item) => item.user_id)
              .map((item) => {
                const encryptedUserName = (item.user_name as string | null) ?? '';
                return [item.user_id as string, encryptedUserName ? decrypt(encryptedUserName) : ''];
              }),
          );
        }
      }

      return Response.json({
        board: boardResult.data,
        contents: posts.map((post) => ({
          ...post,
          slug: String(post.slug),
          author_name: nicknameMap.get(post.user_id) || userNameMap.get(post.user_id) || '',
        })),
      });
    }

    return Response.json({
      board: boardResult.data,
      contents: [],
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '게시판 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '게시판 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
