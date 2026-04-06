import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const planResult = await supabaseAdmin
      .from('plans')
      .select('id, category_key, category_label, plan_key, plan_label, price, product_type')
      .order('sort_order', { ascending: true })
      .order('price', { ascending: true });

    if (planResult.error) {
      return Response.json({ error: '플랜 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      plans: (planResult.data ?? []).map((planRow) => ({
        id: planRow.id,
        categoryKey: planRow.category_key ?? '',
        categoryLabel: planRow.category_label ?? '',
        planKey: planRow.plan_key ?? '',
        planLabel: planRow.plan_label ?? '',
        price: Number(planRow.price ?? 0),
        productType: planRow.product_type ?? '',
      })),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '플랜 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '플랜 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
