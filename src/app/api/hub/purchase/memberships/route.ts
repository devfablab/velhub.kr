import { PAYMENT_STATUS, PAYMENT_TARGET_TYPE, PAYMENT_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';

const statusLabel = (status: string) =>
  ({ paid: '결제 완료', refunded: '환불 완료', partially_refunded: '부분 환불', failed: '결제 실패' })[status] ?? '확인 필요';

const membershipTypeLabel = (membershipType: string) =>
  ({
    owner: '오너 멤버십',
    creator: '크리에이터 멤버십',
    all_in_one: '올인원 멤버십',
    affetto: '아페토 멤버십',
  })[membershipType] ?? '멤버십';

export async function GET() {
  const session = await verifySession({ siteId: null });
  if (!session.stigmaId) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const db = getSupabaseAdmin();
  const paymentsResult = await db
    .from('payments')
    .select('id,target_id,amount,refunded_amount,status,approved_at,created_at')
    .eq('buyer_user_id', session.stigmaId)
    .eq('payment_type', PAYMENT_TYPE.MEMBERSHIP)
    .eq('target_type', PAYMENT_TARGET_TYPE.MEMBERSHIP)
    .order('created_at', { ascending: false });
  if (paymentsResult.error) return Response.json({ error: '멤버십 결제내역을 불러오지 못했습니다.' }, { status: 500 });

  const payments = paymentsResult.data ?? [];
  const membershipIds = payments.map((payment) => payment.target_id).filter((id): id is string => Boolean(id));
  const [membershipsResult, itemsResult] = await Promise.all([
    membershipIds.length
      ? db.from('memberships').select('id,membership_type').in('id', membershipIds)
      : Promise.resolve({ data: [], error: null }),
    membershipIds.length
      ? db.from('membership_items').select('membership_id,plan_id').in('membership_id', membershipIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (membershipsResult.error || itemsResult.error)
    return Response.json({ error: '멤버십 정보를 불러오지 못했습니다.' }, { status: 500 });

  const planIds = (itemsResult.data ?? []).map((item) => item.plan_id);
  const plansResult = planIds.length ? await db.from('plans').select('id,plan_label').in('id', planIds) : { data: [], error: null };
  if (plansResult.error) return Response.json({ error: '멤버십 기능 정보를 불러오지 못했습니다.' }, { status: 500 });

  const membershipById = new Map((membershipsResult.data ?? []).map((membership) => [membership.id, membership]));
  const planById = new Map((plansResult.data ?? []).map((plan) => [plan.id, plan.plan_label]));
  const itemsByMembership = new Map<string, string[]>();
  for (const item of itemsResult.data ?? []) {
    const labels = itemsByMembership.get(item.membership_id) ?? [];
    labels.push(planById.get(item.plan_id) ?? '기능 확인 필요');
    itemsByMembership.set(item.membership_id, labels);
  }
  const successful = payments.filter((payment) => [PAYMENT_STATUS.PAID, PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.PARTIALLY_REFUNDED].includes(payment.status));
  const totalAmount = successful.reduce((sum, payment) => sum + payment.amount, 0);
  const refundedAmount = successful.reduce((sum, payment) => sum + (payment.refunded_amount ?? 0), 0);
  return Response.json({
    summary: { totalAmount, refundedAmount, netAmount: totalAmount - refundedAmount, count: payments.length },
    payments: payments.map((payment) => ({
      ...payment,
      statusLabel: statusLabel(payment.status),
      membershipType: membershipTypeLabel(membershipById.get(payment.target_id ?? '')?.membership_type ?? ''),
      features: itemsByMembership.get(payment.target_id ?? '') ?? [],
    })),
  });
}
