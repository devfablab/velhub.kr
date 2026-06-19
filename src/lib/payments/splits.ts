import { getSupabaseAdmin } from '@/lib/supabase';
import { PAYMENT_SPLIT_RECEIVER_TYPE } from '@/lib/payments/types';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type OwnerPaymentSplitParams = {
  supabaseAdmin: SupabaseAdminClient;
  paymentId: string;
  siteId: string;
  receiverUserId: string;
  amount: number;
  boardId?: string | null;
  seriesId?: string | null;
  postId?: string | null;
};

const PLATFORM_RATE = 17;
const SITE_OWNER_RATE = 83;

function calculateRateAmount(amount: number, rate: number) {
  return Math.round((amount * rate) / 100);
}

export async function createOwnerPaymentSplits({
  supabaseAdmin,
  paymentId,
  siteId,
  receiverUserId,
  amount,
  boardId = null,
  seriesId = null,
  postId = null,
}: OwnerPaymentSplitParams) {
  const existingSplitResult = await supabaseAdmin
    .from('payment_splits')
    .select('id')
    .eq('payment_id', paymentId)
    .limit(1);

  if (existingSplitResult.error) {
    throw new Error('분배 내역을 확인하지 못했습니다.');
  }

  if ((existingSplitResult.data ?? []).length > 0) {
    return;
  }

  const platformAmount = calculateRateAmount(amount, PLATFORM_RATE);
  const siteOwnerAmount = amount - platformAmount;

  const splitInsertResult = await supabaseAdmin.from('payment_splits').insert([
    {
      payment_id: paymentId,
      site_id: siteId,
      board_id: boardId,
      series_id: seriesId,
      post_id: postId,
      receiver_user_id: null,
      receiver_type: PAYMENT_SPLIT_RECEIVER_TYPE.PLATFORM,
      rate: PLATFORM_RATE,
      amount: platformAmount,
    },
    {
      payment_id: paymentId,
      site_id: siteId,
      board_id: boardId,
      series_id: seriesId,
      post_id: postId,
      receiver_user_id: receiverUserId,
      receiver_type: PAYMENT_SPLIT_RECEIVER_TYPE.SITE_OWNER,
      rate: SITE_OWNER_RATE,
      amount: siteOwnerAmount,
    },
  ]);

  if (splitInsertResult.error) {
    throw new Error('분배 내역을 저장하지 못했습니다.');
  }
}
