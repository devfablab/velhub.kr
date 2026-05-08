import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RequestBody = {
  siteName: string | null;
  boardKey: string | null;
  boardLabel: string | null;
  boardType: string | null;
  isActive: boolean | null;
  markdownStatus: string | null;
  writePermission?: string | null;
  postPerPage?: number | null;
  postType?: 'none' | 'prefix' | 'series' | null;
};

type PlanFeatureRow = {
  count_board: number | null;
  count_subpage: number | null;
};

function normalizeBoardKey(rawValue: string | null | undefined) {
  return (rawValue ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
}

function hasInvalidBoardKeyCharacters(value: string) {
  return /[^a-z0-9-]/.test(value);
}

function isAllowedBoardType(value: string) {
  return value === 'basic' || value === 'gallery' || value === 'youtube' || value === 'feed';
}

function isAllowedMarkdownStatus(value: string) {
  return value === 'markdown_default' || value === 'markdown_on' || value === 'markdown_off';
}

function isAllowedWritePermission(value: string) {
  return value === 'member' || value === 'manager' || value === 'community-manager' || value === 'owner';
}

function normalizePostPerPage(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 5;
  }

  const normalizedValue = Math.floor(value);

  if (normalizedValue < 5) {
    return 5;
  }

  if (normalizedValue > 50) {
    return 50;
  }

  return normalizedValue;
}

function isAllowedPostType(value: unknown): value is 'none' | 'prefix' | 'series' {
  return value === 'none' || value === 'prefix' || value === 'series';
}

function toNonNegativeInteger(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as RequestBody;

    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const boardKey = normalizeBoardKey(requestBody.boardKey);
    const boardLabel = normalizeText(requestBody.boardLabel);
    const boardType = normalizeText(requestBody.boardType).toLowerCase();
    const markdownStatus = normalizeText(requestBody.markdownStatus) || 'markdown_default';
    const writePermission = normalizeText(requestBody.writePermission) || 'member';
    const isActive = requestBody.isActive === null ? true : Boolean(requestBody.isActive);
    const postPerPage = normalizePostPerPage(requestBody.postPerPage);
    const postType = requestBody.postType ?? 'none';

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!boardKey) {
      return Response.json({ error: '게시판 식별자를 입력해주세요.' }, { status: 400 });
    }

    if (hasInvalidBoardKeyCharacters(boardKey)) {
      return Response.json({ error: "영소문자, 하이픈('-'), 숫자만 사용 가능합니다." }, { status: 400 });
    }

    if (/^\d/.test(boardKey)) {
      return Response.json({ error: '게시판 식별자는 숫자로 시작할 수 없습니다.' }, { status: 400 });
    }

    if (boardKey.length < 5 || boardKey.length > 15) {
      return Response.json({ error: '게시판 식별자는 5자 이상 15자 이하여야 합니다.' }, { status: 400 });
    }

    if (!boardLabel) {
      return Response.json({ error: '게시판 이름을 입력해주세요.' }, { status: 400 });
    }

    if (!isAllowedBoardType(boardType)) {
      return Response.json({ error: '게시판 종류가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!isAllowedMarkdownStatus(markdownStatus)) {
      return Response.json({ error: '마크다운 사용 설정이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!isAllowedWritePermission(writePermission)) {
      return Response.json({ error: '글 작성 권한 설정이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!isAllowedPostType(postType)) {
      return Response.json({ error: '말머리/연재 설정이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_type, plan_type')
      .eq('site_key', siteName)
      .maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (rhizome.data.site_type !== 'community') {
      return Response.json({ error: '커뮤니티 사이트에서만 게시판을 생성할 수 있습니다.' }, { status: 400 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const duplicateBoard = await supabaseAdmin
      .from('boards')
      .select('id')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', boardKey)
      .maybeSingle();

    if (duplicateBoard.error) {
      return Response.json({ error: '게시판 식별자 확인에 실패했습니다.' }, { status: 500 });
    }

    if (duplicateBoard.data) {
      return Response.json({ error: '이미 존재하는 게시판 식별자입니다.' }, { status: 400 });
    }

    const planFeatureResult = await supabaseAdmin
      .from('plan_features')
      .select('count_board, count_subpage')
      .eq('plan_id', rhizome.data.plan_type)
      .maybeSingle();

    if (planFeatureResult.error || !planFeatureResult.data) {
      return Response.json({ error: '게시판 생성에 실패했습니다.' }, { status: 500 });
    }

    const planFeature = planFeatureResult.data as PlanFeatureRow;
    const maxBoardCount = Math.max(
      0,
      toNonNegativeInteger(planFeature.count_board) - toNonNegativeInteger(planFeature.count_subpage),
    );

    const currentBoardsResult = await supabaseAdmin
      .from('boards')
      .select('id, board_type')
      .eq('site_id', rhizome.data.id);

    if (currentBoardsResult.error) {
      return Response.json({ error: '게시판 생성에 실패했습니다.' }, { status: 500 });
    }

    const currentBoardCount = (currentBoardsResult.data ?? []).filter((board) => board.board_type !== 'page').length;

    if (currentBoardCount >= maxBoardCount) {
      return Response.json({ error: '더 이상 게시판을 생성할 수 없습니다.' }, { status: 400 });
    }

    const lastBoard = await supabaseAdmin
      .from('boards')
      .select('sort_order')
      .eq('site_id', rhizome.data.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastBoard.error) {
      return Response.json({ error: '게시판 생성에 실패했습니다.' }, { status: 500 });
    }

    const nextSortOrder = typeof lastBoard.data?.sort_order === 'number' ? Number(lastBoard.data.sort_order) + 1 : 1;

    const insertBoard = await supabaseAdmin
      .from('boards')
      .insert({
        board_key: boardKey,
        board_label: boardLabel,
        board_type: boardType,
        is_active: isActive,
        sort_order: nextSortOrder,
        site_id: rhizome.data.id,
        markdown_status: markdownStatus,
        write_permission: writePermission,
        post_per_page: postPerPage,
        post_type: rhizome.data.site_type === 'community' ? postType : 'none',
      })
      .select('id, board_key')
      .maybeSingle();

    if (insertBoard.error || !insertBoard.data) {
      return Response.json({ error: '게시판 생성에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      boardId: insertBoard.data.id,
      boardName: insertBoard.data.board_key,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '게시판 생성에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '게시판 생성에 실패했습니다.' }, { status: 500 });
  }
}
