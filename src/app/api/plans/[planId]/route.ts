import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    planId: string;
  }>;
};

type ProductType = 'service' | 'custom' | 'membership';

type RequestBody = {
  categoryKey: string;
  categoryLabel: string;
  planKey: string;
  planLabel: string;
  price: number | string;
  productType: ProductType;
};

function normalizeKey(value: string) {
  return value?.trim().toLowerCase();
}

function normalizePrice(value: number | string) {
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

  const stigma = await supabaseAdmin.from('stigmas').select('role').eq('user_id', sessionClaims.userId).maybeSingle();

  if (stigma.error || !stigma.data) {
    return {
      ok: false as const,
      status: 500,
      error: '사용자 정보를 확인하지 못했습니다.',
    };
  }

  if (stigma.data.role !== 'admin') {
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

    const plan = await supabaseAdmin
      .from('plans')
      .select('id, category_key, category_label, plan_key, plan_label, price, product_type')
      .eq('id', planId)
      .maybeSingle();

    if (plan.error) {
      return Response.json({ error: '멤버십 상품 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!plan.data) {
      return Response.json({ error: '멤버십 상품을 찾을 수 없습니다.' }, { status: 404 });
    }

    return Response.json({
      plan: plan.data,
      feature: null,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        { error: unknownError.message || '멤버십 상품 정보를 불러오지 못했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ error: '멤버십 상품 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await verifyAdmin();

    if (!admin.ok) {
      return Response.json({ error: admin.error }, { status: admin.status });
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
      return Response.json({ error: '멤버십 상품 카테고리 영문명을 입력해주세요.' }, { status: 400 });
    }

    if (!categoryLabel) {
      return Response.json({ error: '멤버십 상품 카테고리 한글명을 입력해주세요.' }, { status: 400 });
    }

    if (!planKey) {
      return Response.json({ error: '멤버십 상품 영문명을 입력해주세요.' }, { status: 400 });
    }

    if (!planLabel) {
      return Response.json({ error: '멤버십 상품 한글명을 입력해주세요.' }, { status: 400 });
    }

    if (!Number.isFinite(price)) {
      return Response.json({ error: '가격을 입력해주세요.' }, { status: 400 });
    }

    if (productType !== 'service' && productType !== 'custom' && productType !== 'membership') {
      return Response.json({ error: '상품 종류를 선택해주세요.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const currentPlan = await supabaseAdmin.from('plans').select('id').eq('id', planId).maybeSingle();

    if (currentPlan.error) {
      return Response.json({ error: '멤버십 상품 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!currentPlan.data) {
      return Response.json({ error: '멤버십 상품을 찾을 수 없습니다.' }, { status: 404 });
    }

    const duplicatePlan = await supabaseAdmin
      .from('plans')
      .select('id')
      .eq('category_key', categoryKey)
      .eq('plan_key', planKey)
      .neq('id', planId)
      .maybeSingle();

    if (duplicatePlan.error) {
      return Response.json({ error: '멤버십 상품 중복 확인에 실패했습니다.' }, { status: 500 });
    }

    if (duplicatePlan.data) {
      return Response.json({ error: '이미 존재하는 멤버십 상품입니다.' }, { status: 400 });
    }

    const updatePlan = await supabaseAdmin
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

    if (updatePlan.error) {
      return Response.json({ error: '멤버십 상품 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '멤버십 상품 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '멤버십 상품 수정에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const admin = await verifyAdmin();

    if (!admin.ok) {
      return Response.json({ error: admin.error }, { status: admin.status });
    }

    const { planId } = await context.params;

    if (!planId || typeof planId !== 'string') {
      return Response.json({ error: 'planId가 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const deletePlan = await supabaseAdmin.from('plans').delete().eq('id', planId);

    if (deletePlan.error) {
      return Response.json({ error: '멤버십 상품 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '멤버십 상품 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '멤버십 상품 삭제에 실패했습니다.' }, { status: 500 });
  }
}
