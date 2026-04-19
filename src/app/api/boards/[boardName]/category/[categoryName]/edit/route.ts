import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
    categoryName: string;
  }>;
};

type RequestBody = {
  siteName: string | null;
  categoryKey: string | null;
  categoryLabel?: string | null;
  summary?: string | null;
  thumbnailImage?: string | null;
};

function normalizeCategoryKey(rawValue: string | null | undefined) {
  return normalizeText(rawValue).toLowerCase();
}

function isValidCategoryKey(value: string) {
  if (value.length < 2 || value.length > 16) {
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

async function getUniqueCategoryLabel({
  supabaseAdmin,
  siteId,
  boardId,
  categoryId,
  baseLabel,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  siteId: string;
  boardId: string;
  categoryId: string;
  baseLabel: string;
}) {
  let nextLabel = baseLabel;
  let suffix = 1;

  while (true) {
    const duplicateLabel = await supabaseAdmin
      .from('board_categories')
      .select('id')
      .eq('site_id', siteId)
      .eq('board_id', boardId)
      .eq('category_label', nextLabel)
      .neq('id', categoryId)
      .maybeSingle();

    if (duplicateLabel.error) {
      throw new Error('카테고리명을 확인하지 못했습니다.');
    }

    if (!duplicateLabel.data) {
      return nextLabel;
    }

    nextLabel = `${baseLabel}${suffix}`;
    suffix += 1;
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { boardName, categoryName } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();
    const normalizedCategoryName = normalizeText(categoryName).toLowerCase();

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!normalizedCategoryName) {
      return Response.json({ error: 'categoryName이 유효하지 않습니다.' }, { status: 400 });
    }

    const requestBody = (await request.json()) as RequestBody;

    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const categoryKey = normalizeCategoryKey(requestBody.categoryKey);
    const categoryLabelInput = normalizeText(requestBody.categoryLabel);
    const summary = normalizeText(requestBody.summary);
    const thumbnailImage = normalizeText(requestBody.thumbnailImage);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!categoryKey) {
      return Response.json({ error: '카테고리 식별자를 입력해주세요.' }, { status: 400 });
    }

    if (!isValidCategoryKey(categoryKey)) {
      return Response.json(
        {
          error:
            '카테고리 식별자는 2자 이상 16자 이하여야 하며, 영소문자/숫자/하이픈/언더스코어만 사용할 수 있고, 최소 한 글자의 영문자를 포함해야 합니다.',
        },
        { status: 400 },
      );
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

    if (session.status === 'FAIL' || session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const board = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_label, board_type, site_id')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (board.data.board_type !== 'blog') {
      return Response.json({ error: '블로그 게시판만 카테고리를 사용할 수 있습니다.' }, { status: 403 });
    }

    const currentCategory = await supabaseAdmin
      .from('board_categories')
      .select('id, category_key, category_label, board_id, site_id')
      .eq('site_id', rhizome.data.id)
      .eq('board_id', board.data.id)
      .eq('category_key', normalizedCategoryName)
      .maybeSingle();

    if (currentCategory.error) {
      return Response.json({ error: '카테고리 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!currentCategory.data) {
      return Response.json({ error: '카테고리를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (categoryKey !== currentCategory.data.category_key) {
      const duplicateKey = await supabaseAdmin
        .from('board_categories')
        .select('id')
        .eq('site_id', rhizome.data.id)
        .eq('board_id', board.data.id)
        .eq('category_key', categoryKey)
        .neq('id', currentCategory.data.id)
        .maybeSingle();

      if (duplicateKey.error) {
        return Response.json({ error: '카테고리 식별자를 확인하지 못했습니다.' }, { status: 500 });
      }

      if (duplicateKey.data) {
        return Response.json({ error: '이미 존재하는 카테고리 식별자입니다.' }, { status: 400 });
      }
    }

    let categoryLabel = categoryLabelInput;

    if (!categoryLabel) {
      categoryLabel = await getUniqueCategoryLabel({
        supabaseAdmin,
        siteId: rhizome.data.id as string,
        boardId: board.data.id as string,
        categoryId: currentCategory.data.id as string,
        baseLabel: categoryKey,
      });
    } else {
      const duplicateLabel = await supabaseAdmin
        .from('board_categories')
        .select('id')
        .eq('site_id', rhizome.data.id)
        .eq('board_id', board.data.id)
        .eq('category_label', categoryLabel)
        .neq('id', currentCategory.data.id)
        .maybeSingle();

      if (duplicateLabel.error) {
        return Response.json({ error: '카테고리명을 확인하지 못했습니다.' }, { status: 500 });
      }

      if (duplicateLabel.data) {
        return Response.json({ error: '이미 존재하는 카테고리명입니다.' }, { status: 400 });
      }
    }

    const updateCategory = await supabaseAdmin
      .from('board_categories')
      .update({
        category_key: categoryKey,
        category_label: categoryLabel,
        summary: summary || null,
        thumbnail_image: thumbnailImage || null,
      })
      .eq('id', currentCategory.data.id)
      .select('id, category_key, category_label, summary, thumbnail_image, sort_order, board_id, site_id, created_at')
      .maybeSingle();

    if (updateCategory.error || !updateCategory.data) {
      return Response.json({ error: '카테고리 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      category: updateCategory.data,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '카테고리 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '카테고리 수정에 실패했습니다.' }, { status: 500 });
  }
}
