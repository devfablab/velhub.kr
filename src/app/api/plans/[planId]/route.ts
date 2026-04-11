import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

type RouteContext = {
  params: Promise<{
    planId: string;
  }>;
};

type ProductType = 'service' | 'custom';

type RequestBody = {
  categoryKey: string | null;
  categoryLabel: string | null;
  planKey: string | null;
  planLabel: string | null;
  price: number | string | null;
  productType: ProductType | null;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function normalizeKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function normalizePrice(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.replaceAll(',', '').trim();

    if (!normalizedValue) {
      return NaN;
    }

    return Number(normalizedValue);
  }

  return NaN;
}

async function verifyAdmin() {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims) {
    return {
      ok: false as const,
      status: 401,
      error: '로그인이 필요합니다.',
    };
  }

  const supabaseAdmin = getSupabaseAdmin();

  const stigmaResult = await supabaseAdmin
    .from('stigmas')
    .select('role')
    .eq('user_id', sessionClaims.userId)
    .maybeSingle();

  if (stigmaResult.error || !stigmaResult.data) {
    return {
      ok: false as const,
      status: 500,
      error: '사용자 정보를 확인하지 못했습니다.',
    };
  }

  if (stigmaResult.data.role !== 'admin') {
    return {
      ok: false as const,
      status: 403,
      error: '접근 권한이 없습니다.',
    };
  }

  return {
    ok: true as const,
  };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { planId } = await context.params;

    if (!planId || typeof planId !== 'string') {
      return Response.json({ error: 'planId가 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const planResult = await supabaseAdmin
      .from('plans')
      .select('id, category_key, category_label, plan_key, plan_label, price, product_type')
      .eq('id', planId)
      .maybeSingle();

    if (planResult.error) {
      return Response.json({ error: '요금제 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!planResult.data) {
      return Response.json({ error: '요금제를 찾을 수 없습니다.' }, { status: 404 });
    }

    const featureResult = await supabaseAdmin
      .from('plan_features')
      .select('id, is_editor_image, is_member, is_board_attachment, count_subpage, count_board, count_user, plan_id')
      .eq('plan_id', planId)
      .maybeSingle();

    if (featureResult.error) {
      return Response.json({ error: '요금제 기능 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      plan: planResult.data,
      feature: featureResult.data ?? null,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '요금제 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '요금제 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const adminResult = await verifyAdmin();

    if (!adminResult.ok) {
      return Response.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const { planId } = await context.params;

    if (!planId || typeof planId !== 'string') {
      return Response.json({ error: 'planId가 유효하지 않습니다.' }, { status: 400 });
    }

    const requestBody = (await request.json()) as RequestBody;

    const categoryKey = normalizeKey(requestBody.categoryKey);
    const categoryLabel = normalizeText(requestBody.categoryLabel);
    const planKey = normalizeKey(requestBody.planKey);
    const planLabel = normalizeText(requestBody.planLabel);
    const price = normalizePrice(requestBody.price);
    const productType = requestBody.productType;

    if (!categoryKey) {
      return Response.json({ error: '요금제 카테고리 영문명을 입력해주세요.' }, { status: 400 });
    }

    if (!categoryLabel) {
      return Response.json({ error: '요금제 카테고리 한글명을 입력해주세요.' }, { status: 400 });
    }

    if (!planKey) {
      return Response.json({ error: '요금제 영문명을 입력해주세요.' }, { status: 400 });
    }

    if (!planLabel) {
      return Response.json({ error: '요금제 한글명을 입력해주세요.' }, { status: 400 });
    }

    if (!Number.isFinite(price)) {
      return Response.json({ error: '가격을 입력해주세요.' }, { status: 400 });
    }

    if (productType !== 'service' && productType !== 'custom') {
      return Response.json({ error: '상품 종류를 선택해주세요.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const currentPlanResult = await supabaseAdmin.from('plans').select('id').eq('id', planId).maybeSingle();

    if (currentPlanResult.error) {
      return Response.json({ error: '요금제 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!currentPlanResult.data) {
      return Response.json({ error: '요금제를 찾을 수 없습니다.' }, { status: 404 });
    }

    const duplicateResult = await supabaseAdmin
      .from('plans')
      .select('id')
      .eq('category_key', categoryKey)
      .eq('plan_key', planKey)
      .neq('id', planId)
      .maybeSingle();

    if (duplicateResult.error) {
      return Response.json({ error: '요금제 중복 확인에 실패했습니다.' }, { status: 500 });
    }

    if (duplicateResult.data) {
      return Response.json({ error: '이미 존재하는 요금제입니다.' }, { status: 400 });
    }

    const updateResult = await supabaseAdmin
      .from('plans')
      .update({
        category_key: categoryKey,
        category_label: categoryLabel,
        plan_key: planKey,
        plan_label: planLabel,
        price,
        product_type: productType,
      })
      .eq('id', planId);

    if (updateResult.error) {
      return Response.json({ error: '요금제 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '요금제 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '요금제 수정에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const adminResult = await verifyAdmin();

    if (!adminResult.ok) {
      return Response.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const { planId } = await context.params;

    if (!planId || typeof planId !== 'string') {
      return Response.json({ error: 'planId가 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const featureDeleteResult = await supabaseAdmin.from('plan_features').delete().eq('plan_id', planId);

    if (featureDeleteResult.error) {
      return Response.json({ error: '요금제 기능 삭제에 실패했습니다.' }, { status: 500 });
    }

    const planDeleteResult = await supabaseAdmin.from('plans').delete().eq('id', planId);

    if (planDeleteResult.error) {
      return Response.json({ error: '요금제 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '요금제 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '요금제 삭제에 실패했습니다.' }, { status: 500 });
  }
}
