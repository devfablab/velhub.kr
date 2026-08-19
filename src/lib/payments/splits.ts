import { PAYMENT_SPLIT_RECEIVER_TYPE } from '@/lib/payments/types';
import { getSupabaseAdmin } from '@/lib/supabase';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type OwnerPaymentSplitParams = {
  supabaseAdmin: SupabaseAdminClient;
  paymentId: string;
  siteId: string;
  siteOwnerStigmaId: string;
  amount: number;
  boardId?: string | null;
  seriesId?: string | null;
  postId?: string | null;
};

type PostPaymentSplitParams = {
  supabaseAdmin: SupabaseAdminClient;
  paymentId: string;
  siteId: string;
  siteOwnerStigmaId: string;
  postAuthorStigmaId: string;
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

async function getPlatformPaymentSplitRate({
  supabaseAdmin,
  siteId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
}) {
  const siteResult = await supabaseAdmin.from('rhizomes').select('site_type').eq('id', siteId).maybeSingle();

  if (siteResult.error || !siteResult.data) {
    throw new Error('사이트 정산 기준을 확인하지 못했습니다.');
  }

  if (siteResult.data.site_type !== 'blog') {
    return 17;
  }

  const blogResult = await supabaseAdmin.from('blogs').select('blog_type').eq('site_id', siteId).maybeSingle();

  if (blogResult.error || !blogResult.data) {
    throw new Error('블로그 정산 기준을 확인하지 못했습니다.');
  }

  return blogResult.data.blog_type === 'team' ? 12 : 17;
}

export async function createOwnerPaymentSplits({
  supabaseAdmin,
  paymentId,
  siteId,
  siteOwnerStigmaId,
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

  const platformRate = await getPlatformPaymentSplitRate({ supabaseAdmin, siteId });
  const platformAmount = Math.floor((amount * platformRate) / 100);
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
      rate: platformRate,
      amount: platformAmount,
    },
    {
      payment_id: paymentId,
      site_id: siteId,
      board_id: boardId,
      series_id: seriesId,
      post_id: postId,
      receiver_user_id: siteOwnerStigmaId,
      receiver_type: PAYMENT_SPLIT_RECEIVER_TYPE.SITE_OWNER,
      rate: 100 - platformRate,
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
  siteOwnerStigmaId,
  postAuthorStigmaId,
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

  const platformRate = await getPlatformPaymentSplitRate({ supabaseAdmin, siteId });
  const platformAmount = Math.floor((amount * platformRate) / 100);

  if (siteOwnerStigmaId === postAuthorStigmaId) {
    const receiverAmount = amount - platformAmount;

    const insertResult = await supabaseAdmin.from('payment_splits').insert([
      {
        payment_id: paymentId,
        site_id: siteId,
        board_id: boardId,
        series_id: seriesId,
        post_id: postId,
        receiver_user_id: null,
        receiver_type: PAYMENT_SPLIT_RECEIVER_TYPE.PLATFORM,
        rate: platformRate,
        amount: platformAmount,
      },
      {
        payment_id: paymentId,
        site_id: siteId,
        board_id: boardId,
        series_id: seriesId,
        post_id: postId,
        receiver_user_id: siteOwnerStigmaId,
        receiver_type: PAYMENT_SPLIT_RECEIVER_TYPE.SITE_OWNER,
        rate: 100 - platformRate,
        amount: receiverAmount,
      },
    ]);

    if (insertResult.error) {
      throw new Error('결제 분배 내역을 저장하지 못했습니다.');
    }

    return;
  }

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
      rate: platformRate,
      amount: platformAmount,
    },
    {
      payment_id: paymentId,
      site_id: siteId,
      board_id: boardId,
      series_id: seriesId,
      post_id: postId,
      receiver_user_id: postAuthorStigmaId,
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
      receiver_user_id: siteOwnerStigmaId,
      receiver_type: PAYMENT_SPLIT_RECEIVER_TYPE.SITE_OWNER,
      rate: 100 - platformRate - 57,
      amount: siteOwnerAmount,
    },
  ]);

  if (insertResult.error) {
    throw new Error('결제 분배 내역을 저장하지 못했습니다.');
  }
}
