import { hasValidBlogSubscription, hasValidSeriesSubscription } from '@/lib/payments/blogDonation';
import { PAYMENT_STATUS, PAYMENT_TARGET_TYPE, PAYMENT_TYPE, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import { getSupabaseAdmin } from '@/lib/supabase';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

/**
 * 구독 연재글은 블로그 또는 해당 연재의 현재 구독자, 영구소장자만 댓글을 볼 수 있다.
 * 작성자와 관리자는 내용 관리·모더레이션을 위해 예외로 접근한다.
 */
export async function canAccessSubscriptionSeriesComments({
  supabaseAdmin,
  siteId,
  boardId,
  postId,
  stigmaId,
  isPrivileged = false,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
  boardId: string;
  postId: string;
  stigmaId: string | null;
  isPrivileged?: boolean;
}) {
  const postResult = await supabaseAdmin
    .from('posts')
    .select('series_id, user_id')
    .eq('id', postId)
    .eq('site_id', siteId)
    .eq('board_id', boardId)
    .maybeSingle();

  if (postResult.error || !postResult.data) {
    throw new Error('글 정보를 확인하지 못했습니다.');
  }

  const seriesId = postResult.data.series_id as string | null;

  if (!seriesId) {
    return true;
  }

  const seriesResult = await supabaseAdmin
    .from('board_series')
    .select('id, is_subscription')
    .eq('id', seriesId)
    .eq('site_id', siteId)
    .eq('board_id', boardId)
    .maybeSingle();

  if (seriesResult.error) {
    throw new Error('연재 정보를 확인하지 못했습니다.');
  }

  if (seriesResult.data?.is_subscription !== true) {
    return true;
  }

  const settingResult = await supabaseAdmin
    .from('subscription_settings')
    .select('is_enabled')
    .eq('target_type', PAYMENT_TARGET_TYPE.SERIES)
    .eq('target_id', seriesId)
    .eq('subscription_type', SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES)
    .maybeSingle();

  if (settingResult.error) {
    throw new Error('연재 구독 설정을 확인하지 못했습니다.');
  }

  if (settingResult.data?.is_enabled !== true) {
    return true;
  }

  if (isPrivileged || (stigmaId && stigmaId === postResult.data.user_id)) {
    return true;
  }

  if (!stigmaId) {
    return false;
  }

  const [hasBlogSubscription, hasSeriesSubscription, purchaseResult] = await Promise.all([
    hasValidBlogSubscription({
      supabaseAdmin,
      subscriberId: stigmaId,
      siteId,
    }),
    hasValidSeriesSubscription({
      supabaseAdmin,
      subscriberId: stigmaId,
      seriesId,
    }),
    supabaseAdmin
      .from('payments')
      .select('id')
      .eq('buyer_user_id', stigmaId)
      .eq('payment_type', PAYMENT_TYPE.PURCHASE_POST)
      .eq('target_type', PAYMENT_TARGET_TYPE.POST)
      .eq('target_id', postId)
      .eq('status', PAYMENT_STATUS.PAID)
      .limit(1),
  ]);

  if (purchaseResult.error) {
    throw new Error('구독 또는 구매 내역을 확인하지 못했습니다.');
  }

  return hasBlogSubscription || hasSeriesSubscription || (purchaseResult.data ?? []).length > 0;
}
