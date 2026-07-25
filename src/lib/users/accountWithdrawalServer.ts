import { cancelAccountRecurringPayments } from '@/lib/payments/cancelAccountRecurringPayments';
import { PAYMENT_STATUS, PAYMENT_TARGET_TYPE, PAYMENT_TYPE } from '@/lib/payments/types';
import { getSupabaseAdmin } from '@/lib/supabase';

export const ACCOUNT_WITHDRAWAL_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
} as const;

export const ACCOUNT_WITHDRAWAL_CONTENT_MESSAGE = '데브허브 탈퇴 신청으로 인한 삭제';
export const ACCOUNT_WITHDRAWAL_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type StigmaRow = {
  id: string;
  user_id: string;
  withdrawal_requested_at: string | null;
  withdrawal_status: string | null;
};

type MembershipRow = {
  id: string;
  site_id: string;
  role: string | null;
};

function getBatches<T>(values: T[], size = 100) {
  const batches: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size));
  }

  return batches;
}

async function getWithdrawalPostIds(supabaseAdmin: SupabaseAdminClient, authUserId: string) {
  const postsResult = await supabaseAdmin
    .from('posts')
    .select('id')
    .eq('user_id', authUserId)
    .eq('is_closed', false)
    .eq('is_locked', false);

  if (postsResult.error) {
    throw new Error('작성한 글을 확인하지 못했습니다.');
  }

  const postIds = (postsResult.data ?? []).map((post) => post.id);
  const protectedPostIds = new Set<string>();

  for (const postIdBatch of getBatches(postIds)) {
    const paymentsResult = await supabaseAdmin
      .from('payments')
      .select('target_id')
      .eq('target_type', PAYMENT_TARGET_TYPE.POST)
      .in('target_id', postIdBatch)
      .in('payment_type', [PAYMENT_TYPE.PURCHASE_POST, PAYMENT_TYPE.DONATION_POST])
      .in('status', [PAYMENT_STATUS.PAID, PAYMENT_STATUS.PARTIALLY_REFUNDED, PAYMENT_STATUS.REFUNDED]);

    if (paymentsResult.error) {
      throw new Error('글의 구매 및 후원 내역을 확인하지 못했습니다.');
    }

    for (const payment of paymentsResult.data ?? []) {
      if (payment.target_id) {
        protectedPostIds.add(payment.target_id);
      }
    }
  }

  return postIds.filter((postId) => !protectedPostIds.has(postId));
}

async function getStigma(supabaseAdmin: SupabaseAdminClient, authUserId: string) {
  const stigmaResult = await supabaseAdmin
    .from('stigmas')
    .select('id, user_id, withdrawal_requested_at, withdrawal_status')
    .eq('user_id', authUserId)
    .maybeSingle();

  if (stigmaResult.error) {
    console.error('[account-withdrawal] stigma select error', stigmaResult.error);
    throw new Error('계정 탈퇴 상태를 확인하지 못했습니다.');
  }

  if (!stigmaResult.data) {
    throw new Error('사용자 정보를 확인하지 못했습니다.');
  }

  return stigmaResult.data as StigmaRow;
}

async function getActiveMemberships(supabaseAdmin: SupabaseAdminClient, stigmaId: string) {
  const membershipResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('id, site_id, role')
    .eq('user_id', stigmaId)
    .eq('is_approval', true)
    .eq('is_block', false)
    .is('kicked_at', null)
    .is('banned_at', null)
    .is('withdrawn_at', null);

  if (membershipResult.error) {
    throw new Error('가입 사이트 정보를 확인하지 못했습니다.');
  }

  return (membershipResult.data ?? []) as MembershipRow[];
}

async function assertNoManagedSites(supabaseAdmin: SupabaseAdminClient, stigmaId: string) {
  const memberships = await getActiveMemberships(supabaseAdmin, stigmaId);

  if (memberships.some((membership) => membership.role === 'owner' || membership.role === 'manager')) {
    throw new Error('운영자 또는 매니저 역할을 하고 있는 사이트가 있어서 탈퇴 신청하실 수 없습니다.');
  }

  if (memberships.length === 0) {
    return;
  }

  const communityRoleResult = await supabaseAdmin
    .from('community_manage_role')
    .select('id')
    .in(
      'manager_id',
      memberships.map((membership) => membership.id),
    )
    .limit(1)
    .maybeSingle();

  if (communityRoleResult.error) {
    throw new Error('사이트 매니저 역할을 확인하지 못했습니다.');
  }

  if (communityRoleResult.data) {
    throw new Error('운영자 또는 매니저 역할을 하고 있는 사이트가 있어서 탈퇴 신청하실 수 없습니다.');
  }
}

export async function requestAccountWithdrawal(authUserId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const stigma = await getStigma(supabaseAdmin, authUserId);

  if (stigma.withdrawal_status === ACCOUNT_WITHDRAWAL_STATUS.COMPLETED) {
    throw new Error('이미 탈퇴 처리된 계정입니다.');
  }

  await assertNoManagedSites(supabaseAdmin, stigma.id);

  const requestedAt =
    stigma.withdrawal_status === ACCOUNT_WITHDRAWAL_STATUS.PENDING && stigma.withdrawal_requested_at
      ? stigma.withdrawal_requested_at
      : new Date().toISOString();

  const stigmaUpdateResult = await supabaseAdmin
    .from('stigmas')
    .update({
      withdrawal_requested_at: requestedAt,
      withdrawal_status: ACCOUNT_WITHDRAWAL_STATUS.PENDING,
    })
    .eq('user_id', authUserId);

  if (stigmaUpdateResult.error) {
    throw new Error('탈퇴 신청 상태를 저장하지 못했습니다.');
  }

  await cancelAccountRecurringPayments({
    supabaseAdmin,
    authUserId,
  });

  const nowIso = new Date().toISOString();
  const withdrawalPostIds = await getWithdrawalPostIds(supabaseAdmin, authUserId);

  for (const postIdBatch of getBatches(withdrawalPostIds)) {
    const postsResult = await supabaseAdmin
      .from('posts')
      .update({
        is_closed: true,
        is_locked: true,
        closed_by: authUserId,
        closed_at: nowIso,
        closed_message: ACCOUNT_WITHDRAWAL_CONTENT_MESSAGE,
      })
      .in('id', postIdBatch)
      .eq('user_id', authUserId)
      .eq('is_closed', false)
      .eq('is_locked', false);

    if (postsResult.error) {
      throw new Error('작성한 글을 탈퇴 상태로 변경하지 못했습니다.');
    }
  }

  const commentsResult = await supabaseAdmin
    .from('post_comments')
    .update({
      is_deleted: true,
      is_locked: true,
      deleted_by: authUserId,
      deleted_at: nowIso,
      deleted_message: ACCOUNT_WITHDRAWAL_CONTENT_MESSAGE,
    })
    .eq('user_id', authUserId)
    .eq('is_deleted', false)
    .eq('is_locked', false);

  if (commentsResult.error) {
    throw new Error('작성한 댓글을 탈퇴 상태로 변경하지 못했습니다.');
  }

  return {
    status: ACCOUNT_WITHDRAWAL_STATUS.PENDING,
    requestedAt,
  };
}

export async function cancelAccountWithdrawal(authUserId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const stigma = await getStigma(supabaseAdmin, authUserId);

  if (stigma.withdrawal_status !== ACCOUNT_WITHDRAWAL_STATUS.PENDING) {
    throw new Error('취소할 탈퇴 신청이 없습니다.');
  }

  const memberships = await getActiveMemberships(supabaseAdmin, stigma.id);
  const activeSiteIds = memberships.map((membership) => membership.site_id);

  if (activeSiteIds.length > 0) {
    const [postsResult, commentsResult] = await Promise.all([
      supabaseAdmin
        .from('posts')
        .update({
          is_closed: false,
          is_locked: false,
          closed_by: null,
          closed_at: null,
          closed_message: null,
        })
        .eq('user_id', authUserId)
        .eq('closed_by', authUserId)
        .eq('closed_message', ACCOUNT_WITHDRAWAL_CONTENT_MESSAGE)
        .in('site_id', activeSiteIds),
      supabaseAdmin
        .from('post_comments')
        .update({
          is_deleted: false,
          is_locked: false,
          deleted_by: null,
          deleted_at: null,
          deleted_message: null,
        })
        .eq('user_id', authUserId)
        .eq('deleted_by', authUserId)
        .eq('deleted_message', ACCOUNT_WITHDRAWAL_CONTENT_MESSAGE)
        .in('site_id', activeSiteIds),
    ]);

    if (postsResult.error || commentsResult.error) {
      throw new Error('작성한 콘텐츠를 복구하지 못했습니다.');
    }
  }

  const stigmaUpdateResult = await supabaseAdmin
    .from('stigmas')
    .update({
      withdrawal_requested_at: null,
      withdrawal_status: null,
    })
    .eq('user_id', authUserId)
    .eq('withdrawal_status', ACCOUNT_WITHDRAWAL_STATUS.PENDING);

  if (stigmaUpdateResult.error) {
    throw new Error('탈퇴 신청을 취소하지 못했습니다.');
  }

  return { status: null };
}

export async function completeAccountWithdrawal({
  supabaseAdmin,
  authUserId,
  completedAt,
}: {
  supabaseAdmin: SupabaseAdminClient;
  authUserId: string;
  completedAt: string;
}) {
  const stigma = await getStigma(supabaseAdmin, authUserId);
  const memberships = await getActiveMemberships(supabaseAdmin, stigma.id);

  if (memberships.length > 0) {
    const membershipResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .update({
        withdrawn_at: completedAt,
        is_rejoin: true,
      })
      .in(
        'id',
        memberships.map((membership) => membership.id),
      );

    if (membershipResult.error) {
      throw new Error('가입 사이트 탈퇴 처리에 실패했습니다.');
    }
  }

  const stigmaResult = await supabaseAdmin
    .from('stigmas')
    .update({
      withdrawal_status: ACCOUNT_WITHDRAWAL_STATUS.COMPLETED,
    })
    .eq('user_id', authUserId)
    .eq('withdrawal_status', ACCOUNT_WITHDRAWAL_STATUS.PENDING);

  if (stigmaResult.error) {
    throw new Error('계정 탈퇴 확정 처리에 실패했습니다.');
  }
}
