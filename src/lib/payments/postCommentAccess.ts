import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { hasValidBlogSubscription, hasValidSeriesSubscription } from '@/lib/payments/blogDonation';
import { PAYMENT_STATUS, PAYMENT_TARGET_TYPE, PAYMENT_TYPE, SUBSCRIPTION_TYPE } from '@/lib/payments/types';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

async function getPostForSite(supabaseAdmin: SupabaseAdminClient, postId: string, siteId: string, boardId: string) {
  const postResult = await supabaseAdmin
    .from('posts')
    .select('series_id, user_id')
    .eq('id', postId)
    .eq('site_id', siteId)
    .eq('board_id', boardId)
    .maybeSingle();

  if (postResult.error || postResult.data) {
    return postResult;
  }

  const coPostResult = await supabaseAdmin
    .from('co_posts')
    .select('partner_series_id')
    .eq('post_id', postId)
    .eq('partner_site_id', siteId)
    .eq('status', 'active')
    .maybeSingle();

  if (coPostResult.error || !coPostResult.data) {
    return { data: null, error: coPostResult.error };
  }

  const sharedPostResult = await supabaseAdmin.from('posts').select('user_id').eq('id', postId).maybeSingle();

  if (sharedPostResult.error || !sharedPostResult.data) {
    return { data: null, error: sharedPostResult.error };
  }

  return {
    data: { series_id: coPostResult.data.partner_series_id as string | null, user_id: sharedPostResult.data.user_id },
    error: null,
  };
}

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
  const postResult = await getPostForSite(supabaseAdmin, postId, siteId, boardId);

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

async function getImageSubscriptionSeriesId({
  supabaseAdmin,
  siteId,
  boardId,
  postId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
  boardId: string;
  postId: string;
}) {
  const postResult = await getPostForSite(supabaseAdmin, postId, siteId, boardId);

  if (postResult.error || !postResult.data) {
    throw new Error('글 정보를 확인하지 못했습니다.');
  }

  const seriesId = postResult.data.series_id as string | null;

  if (!seriesId) {
    return null;
  }

  const [seriesResult, settingResult] = await Promise.all([
    supabaseAdmin
      .from('board_series')
      .select('id, is_subscription')
      .eq('id', seriesId)
      .eq('site_id', siteId)
      .eq('board_id', boardId)
      .maybeSingle(),
    supabaseAdmin
      .from('subscription_settings')
      .select('is_enabled')
      .eq('target_type', PAYMENT_TARGET_TYPE.SERIES)
      .eq('target_id', seriesId)
      .eq('subscription_type', SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES)
      .maybeSingle(),
  ]);

  if (seriesResult.error || settingResult.error) {
    throw new Error('연재 구독 설정을 확인하지 못했습니다.');
  }

  if (seriesResult.data?.is_subscription !== true || settingResult.data?.is_enabled !== true) {
    return null;
  }

  return seriesId;
}

async function hasSeriesSubscriptionOrPurchase({
  supabaseAdmin,
  seriesId,
  postId,
  stigmaId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  seriesId: string;
  postId: string;
  stigmaId: string;
}) {
  const [hasSeriesSubscription, purchaseResult] = await Promise.all([
    hasValidSeriesSubscription({ supabaseAdmin, subscriberId: stigmaId, seriesId }),
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

  return hasSeriesSubscription || (purchaseResult.data ?? []).length > 0;
}

async function isSiteOperator({
  supabaseAdmin,
  siteId,
  boardId,
  stigmaId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
  boardId: string | null;
  stigmaId: string;
}) {
  const [siteResult, membershipResult] = await Promise.all([
    supabaseAdmin.from('rhizomes').select('owner_id').eq('id', siteId).maybeSingle(),
    supabaseAdmin
      .from('rhizome_stigmas')
      .select('id, role')
      .eq('site_id', siteId)
      .eq('user_id', stigmaId)
      .maybeSingle(),
  ]);

  if (siteResult.error || membershipResult.error) {
    throw new Error('운영 권한을 확인하지 못했습니다.');
  }

  if (siteResult.data?.owner_id === stigmaId) {
    return true;
  }

  const role = membershipResult.data?.role;

  if (role === 'owner' || role === 'manager') {
    return true;
  }

  if (!boardId || !membershipResult.data) {
    return false;
  }

  const communityResult = await supabaseAdmin.from('communities').select('id').eq('site_id', siteId).maybeSingle();

  if (communityResult.error || !communityResult.data?.id) {
    return false;
  }

  const manageRoleResult = await supabaseAdmin
    .from('community_manage_role')
    .select('role, board_id')
    .eq('community_id', communityResult.data.id)
    .eq('manager_id', membershipResult.data.id);

  if (manageRoleResult.error) {
    throw new Error('운영 권한을 확인하지 못했습니다.');
  }

  return (manageRoleResult.data ?? []).some(
    (row) =>
      row.role === 'community-manager' ||
      row.role === 'board-manager' ||
      (row.board_id === boardId && (row.role === 'board-general-manager' || row.role === 'board-assistant-manager')),
  );
}

async function getSingleAuthorBlog(supabaseAdmin: SupabaseAdminClient, siteId: string) {
  const [siteResult, blogResult] = await Promise.all([
    supabaseAdmin.from('rhizomes').select('site_type').eq('id', siteId).maybeSingle(),
    supabaseAdmin.from('blogs').select('blog_type, comment_provider').eq('site_id', siteId).maybeSingle(),
  ]);

  if (siteResult.error || blogResult.error) {
    throw new Error('사이트 정보를 확인하지 못했습니다.');
  }

  return {
    isBlog: siteResult.data?.site_type === 'blog',
    isTeamBlog: blogResult.data?.blog_type === 'team',
    commentProvider: (blogResult.data?.comment_provider as string | null) ?? null,
  };
}

export async function canUploadPostCommentImage({
  supabaseAdmin,
  siteId,
  boardId,
  postId,
  stigmaId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
  boardId: string;
  postId: string;
  stigmaId: string | null;
}) {
  if (!stigmaId) {
    return false;
  }

  const site = await getSingleAuthorBlog(supabaseAdmin, siteId);

  if (site.isBlog && !site.isTeamBlog) {
    if (site.commentProvider !== 'velhub') {
      return false;
    }

    if (await isSiteOperator({ supabaseAdmin, siteId, boardId, stigmaId })) {
      return true;
    }

    return hasValidBlogSubscription({ supabaseAdmin, subscriberId: stigmaId, siteId });
  }

  const seriesId = await getImageSubscriptionSeriesId({ supabaseAdmin, siteId, boardId, postId });

  if (!seriesId) {
    return false;
  }

  if (await isSiteOperator({ supabaseAdmin, siteId, boardId, stigmaId })) {
    return true;
  }

  return hasSeriesSubscriptionOrPurchase({ supabaseAdmin, seriesId, postId, stigmaId });
}

export async function canUploadBlogCommunityCommentImage({
  supabaseAdmin,
  siteId,
  stigmaId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
  stigmaId: string | null;
}) {
  if (!stigmaId) {
    return false;
  }

  const site = await getSingleAuthorBlog(supabaseAdmin, siteId);

  if (!site.isBlog || site.isTeamBlog) {
    return false;
  }

  if (await isSiteOperator({ supabaseAdmin, siteId, boardId: null, stigmaId })) {
    return true;
  }

  return hasValidBlogSubscription({ supabaseAdmin, subscriberId: stigmaId, siteId });
}
