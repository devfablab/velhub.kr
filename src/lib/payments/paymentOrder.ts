import { getSupabaseAdmin } from '@/lib/supabase';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

export type PaymentOrder = {
  id: string;
  payment_key: string;
  order_no: string;
  buyer_user_id: string;
  payment_type: string;
  target_type: string;
  target_id: string;
  site_id: string;
  board_id: string | null;
  series_id: string | null;
  post_id: string | null;
  amount: number;
  currency: string;
  status: 'ready' | 'completed' | 'expired';
  expires_at: string;
};

type CreatePaymentOrderInput = Omit<PaymentOrder, 'id' | 'status' | 'expires_at'> & {
  expiresAt?: string;
};

const PAYMENT_ORDER_TTL_MS = 1000 * 60 * 60 * 2;

export async function createPaymentOrder(supabaseAdmin: SupabaseAdminClient, input: CreatePaymentOrderInput) {
  const expiresAt = input.expiresAt ?? new Date(Date.now() + PAYMENT_ORDER_TTL_MS).toISOString();
  const { expiresAt: _expiresAt, ...order } = input;
  const result = await supabaseAdmin
    .from('payment_orders')
    .insert({ ...order, status: 'ready', expires_at: expiresAt })
    .select('*')
    .single();

  if (result.error || !result.data) {
    throw new Error('결제 주문을 생성하지 못했습니다.');
  }

  return result.data as PaymentOrder;
}

export async function getPaymentOrder(
  supabaseAdmin: SupabaseAdminClient,
  { paymentKey, orderNo, buyerUserId }: { paymentKey: string; orderNo: string; buyerUserId: string },
) {
  const result = await supabaseAdmin
    .from('payment_orders')
    .select('*')
    .eq('payment_key', paymentKey)
    .eq('order_no', orderNo)
    .eq('buyer_user_id', buyerUserId)
    .maybeSingle();

  if (result.error) {
    throw new Error('결제 주문을 확인하지 못했습니다.');
  }

  return (result.data as PaymentOrder | null) ?? null;
}

export function assertReadyPaymentOrder(order: PaymentOrder | null) {
  if (!order || order.status !== 'ready' || new Date(order.expires_at).getTime() < Date.now()) {
    throw new Error('유효한 결제 주문을 확인하지 못했습니다. 결제를 다시 시작해 주세요.');
  }

  return order;
}

export async function completePaymentOrder(supabaseAdmin: SupabaseAdminClient, orderId: string) {
  const result = await supabaseAdmin
    .from('payment_orders')
    .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('status', 'ready');

  if (result.error) {
    throw new Error('결제 주문 상태를 갱신하지 못했습니다.');
  }
}
