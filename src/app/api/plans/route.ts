import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

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

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const plansResult = await supabaseAdmin
      .from('plans')
      .select('id, category_key, category_label, plan_key, plan_label, price, product_type, plan_features(id)')
      .order('sort_order', { ascending: true })
      .order('price', { ascending: true });

    if (plansResult.error) {
      return Response.json({ error: '요금제 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      plans: (plansResult.data ?? []).map((planRow) => ({
        id: planRow.id,
        category_key: planRow.category_key,
        category_label: planRow.category_label,
        plan_key: planRow.plan_key,
        plan_label: planRow.plan_label,
        price: planRow.price,
        product_type: planRow.product_type,
        has_feature: Array.isArray(planRow.plan_features) ? planRow.plan_features.length > 0 : false,
      })),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '요금제 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '요금제 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('role')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigmaResult.error || !stigmaResult.data) {
      return Response.json({ error: '사용자 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (stigmaResult.data.role !== 'admin') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
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

    const duplicateResult = await supabaseAdmin
      .from('plans')
      .select('id')
      .eq('category_key', categoryKey)
      .eq('plan_key', planKey)
      .maybeSingle();

    if (duplicateResult.error) {
      return Response.json({ error: '요금제 중복 확인에 실패했습니다.' }, { status: 500 });
    }

    if (duplicateResult.data) {
      return Response.json({ error: '이미 존재하는 요금제입니다.' }, { status: 400 });
    }

    const sortOrderResult = await supabaseAdmin
      .from('plans')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sortOrderResult.error) {
      return Response.json({ error: '요금제 정렬값 확인에 실패했습니다.' }, { status: 500 });
    }

    const nextSortOrder =
      typeof sortOrderResult.data?.sort_order === 'number' ? sortOrderResult.data.sort_order + 1 : 1;

    const insertResult = await supabaseAdmin
      .from('plans')
      .insert({
        category_key: categoryKey,
        category_label: categoryLabel,
        plan_key: planKey,
        plan_label: planLabel,
        price,
        product_type: productType,
        sort_order: nextSortOrder,
      })
      .select('id')
      .maybeSingle();

    if (insertResult.error || !insertResult.data) {
      return Response.json({ error: '요금제 추가에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      planId: insertResult.data.id,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '요금제 추가에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '요금제 추가에 실패했습니다.' }, { status: 500 });
  }
}
