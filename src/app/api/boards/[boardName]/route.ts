import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { normalizeText } from '@/lib/utils';
import { getPostList } from '@/lib/board/getPostList';

type RouteContext = {
  params: Promise<{
    boardName: string;
  }>;
};

function parsePositiveInt(value: string | null, fallbackValue: number) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallbackValue;
  }

  return Math.floor(parsedValue);
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
    const page = parsePositiveInt(requestUrl.searchParams.get('page'), 1);
    const size = parsePositiveInt(requestUrl.searchParams.get('size'), 10);
    const filter = normalizeText(requestUrl.searchParams.get('filter')).toLowerCase() === 'deleted' ? 'deleted' : 'all';

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

    const isStaff = session.case === 'staff';
    const authUserId = session.authUserId ?? null;

    if (rhizome.data.visibility_type !== 'public' || rhizome.data.is_shutdown !== false) {
      if (!isStaff) {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    const board = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_label, board_type, created_at, post_per_page, post_type')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (board.data.board_type === 'page') {
      const from = (page - 1) * size;
      const to = from + size - 1;

      const pageQuery = supabaseAdmin
        .from('pages')
        .select(
          'id, slug, subject, summary, edited_at, sort_order, user_id, board_id, site_id, created_at, og_image, og_image_url, attachment_slug, attachment_origin, is_comment',
          { count: 'exact' },
        )
        .eq('board_id', board.data.id)
        .order('sort_order', { ascending: true })
        .range(from, to);

      const pagesResult = await pageQuery;

      if (pagesResult.error) {
        return Response.json({ error: '페이지 목록을 불러오지 못했습니다.' }, { status: 500 });
      }

      const userIds = Array.from(
        new Set(
          (pagesResult.data ?? []).map((pageRow) => pageRow.user_id).filter((value): value is string => Boolean(value)),
        ),
      );

      const rhizomeStigmasResult =
        userIds.length > 0
          ? await supabaseAdmin
              .from('rhizome_stigmas')
              .select('user_id, nickname')
              .eq('site_id', rhizome.data.id)
              .in('user_id', userIds)
          : { data: [], error: null };

      if (rhizomeStigmasResult.error) {
        return Response.json({ error: '페이지 목록을 불러오지 못했습니다.' }, { status: 500 });
      }

      const stigmaResult =
        userIds.length > 0
          ? await supabaseAdmin.from('stigmas').select('user_id, user_name').in('user_id', userIds)
          : { data: [], error: null };

      if (stigmaResult.error) {
        return Response.json({ error: '페이지 목록을 불러오지 못했습니다.' }, { status: 500 });
      }

      const nicknameMap = new Map(
        (rhizomeStigmasResult.data ?? []).map((row) => [row.user_id as string, normalizeText(row.nickname)]),
      );

      const userNameMap = new Map(
        (stigmaResult.data ?? []).map((row) => {
          let decryptedUserName = '';
          try {
            decryptedUserName = row.user_name ? decrypt(row.user_name as string) : '';
          } catch {
            decryptedUserName = '';
          }
          return [row.user_id as string, decryptedUserName];
        }),
      );

      const contents = (pagesResult.data ?? []).map((pageRow) => ({
        ...pageRow,
        author_name: nicknameMap.get(pageRow.user_id as string) || userNameMap.get(pageRow.user_id as string) || '',
        is_closed: false,
        closed_by: null,
        closed_at: null,
        closed_message: null,
        closed_by_name: '',
        prefix_id: null,
        prefix_label: null,
        post_count: null,
        is_pin: false,
        board_key: board.data.board_key,
        board_label: board.data.board_label,
      }));

      const totalCount = pagesResult.count ?? 0;
      const totalPage = Math.max(1, Math.ceil(totalCount / size));

      return Response.json({
        board: board.data,
        contents,
        page,
        size,
        totalCount,
        totalPage,
        filter,
      });
    }

    const result = await getPostList({
      siteId: rhizome.data.id,
      siteKey: siteName,
      boardId: board.data.id,
      page,
      size,
      filter,
      sessionCase: session.case,
      authUserId,
    });

    return Response.json({
      board: board.data,
      contents: result.contents,
      page,
      size,
      totalCount: result.totalCount,
      totalPage: result.totalPage,
      filter,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '게시판을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '게시판을 불러오지 못했습니다.' }, { status: 500 });
  }
}
