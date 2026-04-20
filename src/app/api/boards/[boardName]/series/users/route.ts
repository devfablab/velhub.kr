import verifySession from '@/lib/session/verifySession';
import { decrypt } from '@/lib/encryption/decrypt';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
  }>;
};

type SearchRow = {
  particleId: string;
  email: string;
  userName: string;
  nickname: string;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { boardName } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();
    const query = normalizeText(requestUrl.searchParams.get('query')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!query) {
      return Response.json({
        users: [],
      });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (session.status === 'FAIL' || session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const board = await supabaseAdmin
      .from('boards')
      .select('id, board_type')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (board.data.board_type === 'page') {
      return Response.json({ error: '페이지 게시판은 시리즈를 사용할 수 없습니다.' }, { status: 403 });
    }

    const membersResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('user_id, nickname')
      .eq('site_id', rhizome.data.id);

    if (membersResult.error) {
      return Response.json({ error: '사용자 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const memberRows = membersResult.data ?? [];
    const stigmaIds = Array.from(
      new Set(
        memberRows
          .map((row) => row.user_id)
          .filter((value): value is string => typeof value === 'string' && Boolean(value)),
      ),
    );

    if (stigmaIds.length === 0) {
      return Response.json({
        users: [],
      });
    }

    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('id, user_id, email, user_name')
      .in('id', stigmaIds);

    if (stigmaResult.error) {
      return Response.json({ error: '사용자 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const stigmaMap = new Map(
      (stigmaResult.data ?? []).map((row) => [
        row.id as string,
        {
          particleId: (row.user_id as string | null) ?? '',
          email: row.email ? decrypt(row.email as string) : '',
          userName: row.user_name ? decrypt(row.user_name as string) : '',
        },
      ]),
    );

    const filteredUsers: SearchRow[] = memberRows
      .map((row) => {
        const stigmaId = row.user_id as string;
        const stigma = stigmaMap.get(stigmaId);

        return {
          particleId: stigma?.particleId ?? '',
          email: stigma?.email ?? '',
          userName: stigma?.userName ?? '',
          nickname: (row.nickname as string | null) ?? '',
        };
      })
      .filter((row) => row.particleId)
      .filter((row) => {
        return (
          row.email.toLowerCase().includes(query) ||
          row.userName.toLowerCase().includes(query) ||
          row.nickname.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        if (a.userName !== b.userName) {
          return a.userName.localeCompare(b.userName);
        }

        if (a.nickname !== b.nickname) {
          return a.nickname.localeCompare(b.nickname);
        }

        return a.email.localeCompare(b.email);
      })
      .slice(0, 20);

    return Response.json({
      users: filteredUsers,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '사용자 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '사용자 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
