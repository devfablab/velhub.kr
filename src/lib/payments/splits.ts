import { PAYMENT_SPLIT_RECEIVER_TYPE } from '@/lib/payments/types';
import { getSupabaseAdmin } from '@/lib/supabase';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type OwnerPaymentSplitParams = {
  supabaseAdmin: SupabaseAdminClient;
  paymentId: string;
  siteId: string;
  siteOwnerUserId: string;
  amount: number;
  boardId?: string | null;
  seriesId?: string | null;
  postId?: string | null;
};

type PostPaymentSplitParams = {
  supabaseAdmin: SupabaseAdminClient;
  paymentId: string;
  siteId: string;
  siteOwnerUserId: string;
  postAuthorUserId: string;
  amount: number;
  boardId?: string | null;
  seriesId?: string | null;
  postId?: string | null;
};

async function hasPaymentSplits({
  supabaseAdmin,
  paymentId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  paymentId: string;
}) {
  const splitsResult = await supabaseAdmin.from('payment_splits').select('id').eq('payment_id', paymentId).limit(1);

  if (splitsResult.error) {
    throw new Error('결제 분배 내역을 확인하지 못했습니다.');
  }

  return Boolean(splitsResult.data?.length);
}

export async function createOwnerPaymentSplits({
  supabaseAdmin,
  paymentId,
  siteId,
  siteOwnerUserId,
  amount,
  boardId = null,
  seriesId = null,
  postId = null,
}: OwnerPaymentSplitParams) {
  const alreadyExists = await hasPaymentSplits({
    supabaseAdmin,
    paymentId,
  });

  if (alreadyExists) {
    return;
  }

  const platformAmount = Math.floor(amount * 0.17);
  const siteOwnerAmount = amount - platformAmount;

  const insertResult = await supabaseAdmin.from('payment_splits').insert([
    {
      payment_id: paymentId,
      site_id: siteId,
      board_id: boardId,
      series_id: seriesId,
      post_id: postId,
      receiver_user_id: null,
      receiver_type: PAYMENT_SPLIT_RECEIVER_TYPE.PLATFORM,
      rate: 17,
      amount: platformAmount,
    },
    {
      payment_id: paymentId,
      site_id: siteId,
      board_id: boardId,
      series_id: seriesId,
      post_id: postId,
      receiver_user_id: siteOwnerUserId,
      receiver_type: PAYMENT_SPLIT_RECEIVER_TYPE.SITE_OWNER,
      rate: 83,
      amount: siteOwnerAmount,
    },
  ]);

  if (insertResult.error) {
    throw new Error('결제 분배 내역을 저장하지 못했습니다.');
  }
}

export async function createPostPaymentSplits({
  supabaseAdmin,
  paymentId,
  siteId,
  siteOwnerUserId,
  postAuthorUserId,
  amount,
  boardId = null,
  seriesId = null,
  postId = null,
}: PostPaymentSplitParams) {
  const alreadyExists = await hasPaymentSplits({
    supabaseAdmin,
    paymentId,
  });

  if (alreadyExists) {
    return;
  }

  const platformAmount = Math.floor(amount * 0.17);
  const postAuthorAmount = Math.floor(amount * 0.57);
  const siteOwnerAmount = amount - platformAmount - postAuthorAmount;

  const insertResult = await supabaseAdmin.from('payment_splits').insert([
    {
      payment_id: paymentId,
      site_id: siteId,
      board_id: boardId,
      series_id: seriesId,
      post_id: postId,
      receiver_user_id: null,
      receiver_type: PAYMENT_SPLIT_RECEIVER_TYPE.PLATFORM,
      rate: 17,
      amount: platformAmount,
    },
    {
      payment_id: paymentId,
      site_id: siteId,
      board_id: boardId,
      series_id: seriesId,
      post_id: postId,
      receiver_user_id: postAuthorUserId,
      receiver_type: PAYMENT_SPLIT_RECEIVER_TYPE.POST_AUTHOR,
      rate: 57,
      amount: postAuthorAmount,
    },
    {
      payment_id: paymentId,
      site_id: siteId,
      board_id: boardId,
      series_id: seriesId,
      post_id: postId,
      receiver_user_id: siteOwnerUserId,
      receiver_type: PAYMENT_SPLIT_RECEIVER_TYPE.SITE_OWNER,
      rate: 26,
      amount: siteOwnerAmount,
    },
  ]);

  if (insertResult.error) {
    throw new Error('결제 분배 내역을 저장하지 못했습니다.');
  }
}
