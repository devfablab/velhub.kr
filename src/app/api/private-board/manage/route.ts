import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type CategoryInput = {
  id?: string | null;
  label?: string | null;
};

type RequestBody = {
  siteName?: string | null;
  boardLabel?: string | null;
  isImageEnabled?: boolean | null;
  categories?: CategoryInput[] | null;
};

function normalizeCategories(categories: CategoryInput[] | null | undefined) {
  const labels = (categories ?? []).map((category) => normalizeText(category.label)).filter(Boolean);

  return [...new Set(labels)];
}

async function getManageAccess(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const site = await supabaseAdmin.from('rhizomes').select('id, site_type').eq('site_key', siteName).maybeSingle();

  if (site.error || !site.data) {
    return { ok: false, status: 404, error: '사이트를 찾을 수 없습니다.' } as const;
  }

  const session = await getSessionClaims();

  if (!session?.userId) {
    return { ok: false, status: 401, error: '로그인이 필요합니다.' } as const;
  }

  const stigma = await supabaseAdmin.from('stigmas').select('id, role').eq('user_id', session.userId).maybeSingle();

  if (stigma.error || !stigma.data) {
    return { ok: false, status: 403, error: '접근 권한이 없습니다.' } as const;
  }

  if (stigma.data.role === 'admin') {
    return { ok: true, supabaseAdmin, site: site.data } as const;
  }

  const membership = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('id, role')
    .eq('site_id', site.data.id)
    .eq('user_id', stigma.data.id)
    .maybeSingle();

  if (membership.error || !membership.data) {
    return { ok: false, status: 403, error: '접근 권한이 없습니다.' } as const;
  }

  if (membership.data.role === 'owner') {
    return { ok: true, supabaseAdmin, site: site.data } as const;
  }

  const community = await supabaseAdmin.from('communities').select('id').eq('site_id', site.data.id).maybeSingle();

  if (community.error || !community.data) {
    return { ok: false, status: 403, error: '접근 권한이 없습니다.' } as const;
  }

  const communityManager = await supabaseAdmin
    .from('community_manage_role')
    .select('id')
    .eq('community_id', community.data.id)
    .eq('manager_id', membership.data.id)
    .eq('role', 'community-manager')
    .maybeSingle();

  if (communityManager.error || !communityManager.data) {
    return { ok: false, status: 403, error: '접근 권한이 없습니다.' } as const;
  }

  return { ok: true, supabaseAdmin, site: site.data } as const;
}

export async function GET(request: Request) {
  const siteName = normalizeText(new URL(request.url).searchParams.get('siteName')).toLowerCase();

  if (!siteName) {
    return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
  }

  const access = await getManageAccess(siteName);

  if (!access.ok) {
    return Response.json({ error: access.error }, { status: access.status });
  }

  const board = await access.supabaseAdmin
    .from('private_boards')
    .select('id, board_label, is_image_enabled')
    .eq('site_id', access.site.id)
    .maybeSingle();

  if (board.error) {
    return Response.json({ error: '비공개 게시판 정보를 불러오지 못했습니다.' }, { status: 500 });
  }

  const categories = board.data
    ? await access.supabaseAdmin
        .from('private_board_categories')
        .select('id, category_label, is_default, sort_order')
        .eq('private_board_id', board.data.id)
        .order('sort_order')
    : null;

  if (categories?.error) {
    return Response.json({ error: '카테고리를 불러오지 못했습니다.' }, { status: 500 });
  }

  return Response.json({
    siteType: access.site.site_type,
    board: board.data,
    categories: categories?.data ?? [],
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as RequestBody;
  const siteName = normalizeText(body.siteName).toLowerCase();
  const boardLabel = normalizeText(body.boardLabel);
  const categories = normalizeCategories(body.categories);

  if (!siteName || !boardLabel || categories.length === 0) {
    return Response.json({ error: '게시판 이름과 카테고리를 입력해 주세요.' }, { status: 400 });
  }

  const access = await getManageAccess(siteName);

  if (!access.ok) {
    return Response.json({ error: access.error }, { status: access.status });
  }

  const existing = await access.supabaseAdmin
    .from('private_boards')
    .select('id')
    .eq('site_id', access.site.id)
    .maybeSingle();

  if (existing.error) {
    return Response.json({ error: '비공개 게시판 설치 여부를 확인하지 못했습니다.' }, { status: 500 });
  }

  if (existing.data) {
    return Response.json({ error: '이미 비공개 게시판이 설치되어 있습니다.' }, { status: 409 });
  }

  const board = await access.supabaseAdmin
    .from('private_boards')
    .insert({
      site_id: access.site.id,
      board_label: boardLabel,
      is_image_enabled: body.isImageEnabled !== false,
    })
    .select('id, board_label, is_image_enabled')
    .single();

  if (board.error || !board.data) {
    return Response.json({ error: '비공개 게시판 설치에 실패했습니다.' }, { status: 500 });
  }

  const categoryResult = await access.supabaseAdmin
    .from('private_board_categories')
    .insert(
      categories.map((categoryLabel, index) => ({
        private_board_id: board.data.id,
        category_label: categoryLabel,
        is_default: index === 0,
        sort_order: index,
      })),
    )
    .select('id, category_label');

  if (categoryResult.error) {
    await access.supabaseAdmin.from('private_boards').delete().eq('id', board.data.id);
    return Response.json({ error: '비공개 게시판 설치에 실패했습니다.' }, { status: 500 });
  }

  return Response.json({ board: board.data, categories: categoryResult.data ?? [] }, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as RequestBody;
  const siteName = normalizeText(body.siteName).toLowerCase();
  const boardLabel = normalizeText(body.boardLabel);
  const categories = normalizeCategories(body.categories);

  if (!siteName || !boardLabel || categories.length === 0) {
    return Response.json({ error: '게시판 이름과 카테고리를 입력해 주세요.' }, { status: 400 });
  }

  const access = await getManageAccess(siteName);

  if (!access.ok) {
    return Response.json({ error: access.error }, { status: access.status });
  }

  const board = await access.supabaseAdmin
    .from('private_boards')
    .select('id')
    .eq('site_id', access.site.id)
    .maybeSingle();

  if (board.error || !board.data) {
    return Response.json({ error: '설치된 비공개 게시판을 찾을 수 없습니다.' }, { status: 404 });
  }

  const boardId = board.data.id;

  const existingCategories = await access.supabaseAdmin
    .from('private_board_categories')
    .select('id')
    .eq('private_board_id', boardId);

  if (existingCategories.error) {
    return Response.json({ error: '카테고리를 확인하지 못했습니다.' }, { status: 500 });
  }

  const requestedIds = new Set(
    (body.categories ?? [])
      .map((category) => normalizeText(category.id))
      .filter((id) => id && existingCategories.data?.some((category) => category.id === id)),
  );
  const requestedEntries = (body.categories ?? [])
    .map((category) => ({ id: normalizeText(category.id) || null, label: normalizeText(category.label) }))
    .filter((category) => category.label);

  const newEntries = requestedEntries.filter((category) => !category.id);
  const insertedCategories = newEntries.length
    ? await access.supabaseAdmin
        .from('private_board_categories')
        .insert(
          newEntries.map((category, index) => ({
            private_board_id: boardId,
            category_label: category.label,
            is_default: false,
            sort_order: categories.length + index,
          })),
        )
        .select('id, category_label')
    : { data: [], error: null };

  if (insertedCategories.error) {
    return Response.json({ error: '카테고리 저장에 실패했습니다.' }, { status: 500 });
  }

  const insertedByLabel = new Map(
    (insertedCategories.data ?? []).map((category) => [category.category_label, category.id]),
  );
  const nextCategories = requestedEntries.map((category, index) => ({
    id: category.id ?? insertedByLabel.get(category.label) ?? '',
    category_label: category.label,
    is_default: index === 0,
    sort_order: index,
  }));

  if (nextCategories.some((category) => !category.id)) {
    return Response.json({ error: '카테고리 저장에 실패했습니다.' }, { status: 500 });
  }

  const clearDefaultCategory = await access.supabaseAdmin
    .from('private_board_categories')
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('private_board_id', boardId);

  if (clearDefaultCategory.error) {
    return Response.json({ error: '카테고리 저장에 실패했습니다.' }, { status: 500 });
  }

  for (const category of nextCategories) {
    const updateCategory = await access.supabaseAdmin
      .from('private_board_categories')
      .update({
        category_label: category.category_label,
        is_default: category.is_default,
        sort_order: category.sort_order,
        updated_at: new Date().toISOString(),
      })
      .eq('id', category.id)
      .eq('private_board_id', boardId);

    if (updateCategory.error) {
      return Response.json({ error: '카테고리 저장에 실패했습니다.' }, { status: 500 });
    }
  }

  const removedCategoryIds = (existingCategories.data ?? [])
    .map((category) => category.id)
    .filter((id) => !requestedIds.has(id));

  if (removedCategoryIds.length > 0) {
    const movePosts = await access.supabaseAdmin
      .from('private_posts')
      .update({ category_id: nextCategories[0].id })
      .eq('private_board_id', boardId)
      .in('category_id', removedCategoryIds);

    if (movePosts.error) {
      return Response.json({ error: '카테고리 저장에 실패했습니다.' }, { status: 500 });
    }

    const deleteCategories = await access.supabaseAdmin
      .from('private_board_categories')
      .delete()
      .eq('private_board_id', boardId)
      .in('id', removedCategoryIds);

    if (deleteCategories.error) {
      return Response.json({ error: '카테고리 저장에 실패했습니다.' }, { status: 500 });
    }
  }

  const updateBoard = await access.supabaseAdmin
    .from('private_boards')
    .update({
      board_label: boardLabel,
      is_image_enabled: body.isImageEnabled !== false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', boardId);

  if (updateBoard.error) {
    return Response.json({ error: '비공개 게시판 수정에 실패했습니다.' }, { status: 500 });
  }

  const updatedBoard = await access.supabaseAdmin
    .from('private_boards')
    .select('id, board_label, is_image_enabled')
    .eq('id', boardId)
    .single();

  if (updatedBoard.error || !updatedBoard.data) {
    return Response.json({ error: '수정된 비공개 게시판 정보를 불러오지 못했습니다.' }, { status: 500 });
  }

  return Response.json({ board: updatedBoard.data, categories: nextCategories }, { status: 200 });
}
