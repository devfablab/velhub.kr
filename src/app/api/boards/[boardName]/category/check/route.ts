import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
  }>;
};

function isValidCategoryKey(value: string) {
  if (value.length < 5 || value.length > 15) {
    return false;
  }

  if (!/[a-z]/.test(value)) {
    return false;
  }

  if (/[^a-z0-9\-_]/.test(value)) {
    return false;
  }

  if (value.startsWith('_') || value.endsWith('_')) {
    return false;
  }

  if (value.includes('__')) {
    return false;
  }

  return true;
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
    const type = normalizeText(requestUrl.searchParams.get('type')).toLowerCase();
    const value = normalizeText(requestUrl.searchParams.get('value'));
    const ignoreCategoryName = normalizeText(requestUrl.searchParams.get('ignoreCategoryName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (type !== 'key' && type !== 'label') {
      return Response.json({ error: 'type이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!value) {
      return Response.json({ error: 'value가 유효하지 않습니다.' }, { status: 400 });
    }

    if (type === 'key') {
      const normalizedKey = value.toLowerCase();

      if (!isValidCategoryKey(normalizedKey)) {
        return Response.json(
          {
            error:
              '카테고리 식별자는 5자 이상 15자 이하여야 하며, 영소문자/숫자/하이픈/언더스코어만 사용할 수 있고, 최소 한 글자의 영문자를 포함해야 합니다.',
          },
          { status: 400 },
        );
      }
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin.from('rhizomes').select('id, site_type').eq('site_key', siteName).maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (rhizome.data.site_type !== 'blog') {
      return Response.json({ error: '카테고리는 블로그에서만 사용할 수 있습니다.' }, { status: 403 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (session.case !== 'staff') {
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

    if (board.data.board_type !== 'blog') {
      return Response.json({ error: '블로그 게시판만 카테고리를 사용할 수 있습니다.' }, { status: 403 });
    }

    let ignoreCategoryId: string | null = null;

    if (ignoreCategoryName) {
      const currentCategory = await supabaseAdmin
        .from('board_categories')
        .select('id')
        .eq('site_id', rhizome.data.id)
        .eq('board_id', board.data.id)
        .eq('category_key', ignoreCategoryName)
        .maybeSingle();

      if (currentCategory.error) {
        return Response.json({ error: '카테고리 정보를 확인하지 못했습니다.' }, { status: 500 });
      }

      ignoreCategoryId = currentCategory.data?.id ?? null;
    }

    const query = supabaseAdmin
      .from('board_categories')
      .select('id')
      .eq('site_id', rhizome.data.id)
      .eq('board_id', board.data.id)
      .eq(type === 'key' ? 'category_key' : 'category_label', type === 'key' ? value.toLowerCase() : value);

    const duplicate = ignoreCategoryId
      ? await query.neq('id', ignoreCategoryId).maybeSingle()
      : await query.maybeSingle();

    if (duplicate.error) {
      return Response.json({ error: '중복 확인에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      available: !duplicate.data,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '중복 확인에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '중복 확인에 실패했습니다.' }, { status: 500 });
  }
}
