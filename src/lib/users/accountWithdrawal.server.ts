import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { encrypt } from '@/lib/encryption/encrypt';
import { cancelAccountRecurringPayments } from '@/lib/payments/cancelAccountRecurringPayments';
import { callCommunityChatWorker } from '@/lib/service/community/communityChat';

export { ACCOUNT_WITHDRAWAL_GRACE_MS } from '@/lib/users/accountWithdrawal.shared';

export const ACCOUNT_WITHDRAWAL_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
} as const;

export const ACCOUNT_WITHDRAWAL_CONTENT_MESSAGE = '데브허브 탈퇴 신청으로 인한 삭제';
export const WITHDRAWN_USER_NAME = '탈퇴한 유저';
export const WITHDRAWN_ACCOUNT_RECORD_RETENTION_MS = 5 * 365 * 24 * 60 * 60 * 1000;

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type StigmaRow = {
  id: string;
  user_id: string;
  user_name: string | null;
  email: string | null;
  payment_email: string | null;
  payment_phone: string | null;
  bio: string | null;
  avatar: string | null;
  withdrawal_requested_at: string | null;
  withdrawal_status: string | null;
};

type MembershipRow = {
  id: string;
  site_id: string;
  role: string | null;
  nickname: string | null;
  is_approval: boolean | null;
  is_block: boolean | null;
  kicked_at: string | null;
  banned_at: string | null;
  withdrawn_at: string | null;
};

const STIGMA_COLUMNS =
  'id, user_id, user_name, email, payment_email, payment_phone, bio, avatar, withdrawal_requested_at, withdrawal_status';

async function getStigma(supabaseAdmin: SupabaseAdminClient, authUserId: string) {
  const stigmaResult = await supabaseAdmin
    .from('stigmas')
    .select(STIGMA_COLUMNS)
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

async function getMemberships(supabaseAdmin: SupabaseAdminClient, stigmaId: string) {
  const membershipResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('id, site_id, role, nickname, is_approval, is_block, kicked_at, banned_at, withdrawn_at')
    .eq('user_id', stigmaId);

  if (membershipResult.error) {
    throw new Error('가입 사이트 정보를 확인하지 못했습니다.');
  }

  return (membershipResult.data ?? []) as MembershipRow[];
}

function isActiveMembership(membership: MembershipRow) {
  return (
    membership.is_approval === true &&
    membership.is_block === false &&
    !membership.kicked_at &&
    !membership.banned_at &&
    !membership.withdrawn_at
  );
}

async function assertNoManagedSites(supabaseAdmin: SupabaseAdminClient, stigmaId: string) {
  const memberships = (await getMemberships(supabaseAdmin, stigmaId)).filter(isActiveMembership);

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

function getWithdrawnHandleName(stigmaId: string) {
  return `withdrawn-${stigmaId.replace(/-/g, '').slice(0, 16)}`;
}

function getWithdrawnLoginEmail(authUserId: string) {
  return `withdrawn-${authUserId}@withdrawn.invalid`;
}

async function saveWithdrawnAccountRecord({
  supabaseAdmin,
  stigma,
  memberships,
  completedAt,
}: {
  supabaseAdmin: SupabaseAdminClient;
  stigma: StigmaRow;
  memberships: MembershipRow[];
  completedAt: string;
}) {
  const existingResult = await supabaseAdmin
    .from('withdrawn_account_records')
    .select('id')
    .eq('stigma_id', stigma.id)
    .maybeSingle();

  if (existingResult.error) {
    throw new Error('탈퇴 계정 보관 정보를 확인하지 못했습니다.');
  }

  if (existingResult.data) {
    return;
  }

  const [particleResult, creatorResult, userResult] = await Promise.all([
    supabaseAdmin.from('particles').select('email, social').eq('id', stigma.user_id).maybeSingle(),
    supabaseAdmin
      .from('creators')
      .select('handle_name, cover_image, summary, introduction')
      .eq('user_id', stigma.id)
      .maybeSingle(),
    supabaseAdmin.from('users').select('handle_name, cover_image, introduction').eq('user_id', stigma.id).maybeSingle(),
  ]);

  if (particleResult.error || creatorResult.error || userResult.error) {
    throw new Error('탈퇴 계정 정보를 확인하지 못했습니다.');
  }

  const loginEmail = typeof particleResult.data?.email === 'string' ? particleResult.data.email : null;
  const creator = creatorResult.data;
  const legacyUser = userResult.data;

  const insertResult = await supabaseAdmin.from('withdrawn_account_records').insert({
    stigma_id: stigma.id,
    auth_user_id: stigma.user_id,
    login_email: loginEmail ? encrypt(loginEmail) : null,
    is_social: particleResult.data?.social ?? null,
    user_name: stigma.user_name,
    email: stigma.email,
    payment_email: stigma.payment_email,
    payment_phone: stigma.payment_phone,
    bio: stigma.bio,
    avatar: stigma.avatar,
    handle_name: creator?.handle_name ?? legacyUser?.handle_name ?? null,
    cover_image: creator?.cover_image ?? legacyUser?.cover_image ?? null,
    summary: creator?.summary ?? null,
    introduction: creator?.introduction ?? legacyUser?.introduction ?? null,
    site_nicknames: memberships
      .filter((membership) => membership.nickname)
      .map((membership) => ({ siteId: membership.site_id, nickname: membership.nickname })),
    requested_at: stigma.withdrawal_requested_at,
    completed_at: completedAt,
    expires_at: new Date(new Date(completedAt).getTime() + WITHDRAWN_ACCOUNT_RECORD_RETENTION_MS).toISOString(),
  });

  if (insertResult.error) {
    console.error('[account-withdrawal] record insert error', insertResult.error);
    throw new Error('탈퇴 계정 정보를 보관하지 못했습니다.');
  }
}

async function deleteCommunityChatMessages({
  supabaseAdmin,
  stigmaId,
  siteIds,
}: {
  supabaseAdmin: SupabaseAdminClient;
  stigmaId: string;
  siteIds: string[];
}) {
  const deleteResult = await supabaseAdmin.from('community_chat_messages').delete().eq('stigma_id', stigmaId);

  if (deleteResult.error) {
    throw new Error('커뮤니티 채팅 메시지를 삭제하지 못했습니다.');
  }

  if (siteIds.length === 0) {
    return;
  }

  const roomsResult = await supabaseAdmin.from('community_chat_rooms').select('site_id').in('site_id', siteIds);

  if (roomsResult.error) {
    throw new Error('커뮤니티 채팅방을 확인하지 못했습니다.');
  }

  for (const room of roomsResult.data ?? []) {
    await callCommunityChatWorker(`/rooms/${room.site_id}/authors/${stigmaId}/messages`, { method: 'DELETE' });
  }
}

async function deleteAccountRelations(supabaseAdmin: SupabaseAdminClient, stigma: StigmaRow) {
  const creatorResult = await supabaseAdmin.from('creators').select('id').eq('user_id', stigma.id).maybeSingle();

  if (creatorResult.error) {
    throw new Error('작가 프로필을 확인하지 못했습니다.');
  }

  const creatorId = creatorResult.data?.id as string | undefined;
  const results = await Promise.all([
    supabaseAdmin.from('creator_follows').delete().eq('follower_id', stigma.id),
    creatorId ? supabaseAdmin.from('creator_follows').delete().eq('creator_id', creatorId) : null,
    creatorId ? supabaseAdmin.from('creator_links').delete().eq('creator_id', creatorId) : null,
    supabaseAdmin.from('blog_favorites').delete().eq('user_id', stigma.id),
    supabaseAdmin.from('post_saves').delete().eq('user_id', stigma.id),
    supabaseAdmin.from('notifications').delete().eq('user_id', stigma.id),
    supabaseAdmin.from('electrons').delete().eq('user_id', stigma.user_id),
    supabaseAdmin
      .from('co_posts')
      .update({ status: 'canceled', responded_at: new Date().toISOString() })
      .eq('status', 'invited')
      .or(`inviter_id.eq.${stigma.id},partner_id.eq.${stigma.id}`),
  ]);

  if (results.some((result) => result?.error)) {
    console.error(
      '[account-withdrawal] relation cleanup error',
      results.map((result) => result?.error).filter(Boolean),
    );
    throw new Error('탈퇴 계정의 연결 정보를 정리하지 못했습니다.');
  }

  const folderResult = await supabaseAdmin.from('favorite_folders').delete().eq('user_id', stigma.id);

  if (folderResult.error) {
    throw new Error('즐겨찾기 폴더를 삭제하지 못했습니다.');
  }
}

async function anonymizeAccount(supabaseAdmin: SupabaseAdminClient, stigma: StigmaRow) {
  const results = await Promise.all([
    supabaseAdmin.from('rhizome_stigmas').update({ nickname: null }).eq('user_id', stigma.id),
    supabaseAdmin
      .from('creators')
      .update({ handle_name: null, cover_image: null, summary: null, introduction: null })
      .eq('user_id', stigma.id),
    supabaseAdmin
      .from('users')
      .update({ handle_name: getWithdrawnHandleName(stigma.id), cover_image: null, introduction: null })
      .eq('user_id', stigma.id),
    supabaseAdmin
      .from('particles')
      .update({ email: getWithdrawnLoginEmail(stigma.user_id) })
      .eq('id', stigma.user_id),
  ]);

  if (results.some((result) => result.error)) {
    console.error('[account-withdrawal] anonymize error', results.map((result) => result.error).filter(Boolean));
    throw new Error('탈퇴 계정의 개인정보를 정리하지 못했습니다.');
  }
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

  if (stigma.withdrawal_status !== ACCOUNT_WITHDRAWAL_STATUS.PENDING) {
    return;
  }

  const memberships = await getMemberships(supabaseAdmin, stigma.id);

  await saveWithdrawnAccountRecord({ supabaseAdmin, stigma, memberships, completedAt });

  const activeMembershipIds = memberships.filter(isActiveMembership).map((membership) => membership.id);

  if (activeMembershipIds.length > 0) {
    const membershipResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .update({
        withdrawn_at: completedAt,
        is_rejoin: true,
      })
      .in('id', activeMembershipIds);

    if (membershipResult.error) {
      throw new Error('가입 사이트 탈퇴 처리에 실패했습니다.');
    }
  }

  await deleteCommunityChatMessages({
    supabaseAdmin,
    stigmaId: stigma.id,
    siteIds: [...new Set(memberships.map((membership) => membership.site_id))],
  });
  await deleteAccountRelations(supabaseAdmin, stigma);
  await anonymizeAccount(supabaseAdmin, stigma);

  const stigmaResult = await supabaseAdmin
    .from('stigmas')
    .update({
      user_name: encrypt(WITHDRAWN_USER_NAME),
      email: encrypt(''),
      payment_email: null,
      payment_phone: null,
      bio: null,
      avatar: null,
      avatar_width: null,
      avatar_height: null,
      withdrawal_status: ACCOUNT_WITHDRAWAL_STATUS.COMPLETED,
    })
    .eq('user_id', authUserId)
    .eq('withdrawal_status', ACCOUNT_WITHDRAWAL_STATUS.PENDING);

  if (stigmaResult.error) {
    throw new Error('계정 탈퇴 확정 처리에 실패했습니다.');
  }

  const authDeleteResult = await supabaseAdmin.auth.admin.deleteUser(authUserId);

  if (authDeleteResult.error) {
    console.error('[account-withdrawal] supabase auth delete error', authDeleteResult.error);
  }
}

export async function deleteExpiredWithdrawnAccountRecords(supabaseAdmin: SupabaseAdminClient, now: string) {
  const deleteResult = await supabaseAdmin.from('withdrawn_account_records').delete().lt('expires_at', now);

  if (deleteResult.error) {
    throw new Error('보관 기간이 지난 탈퇴 계정 정보를 삭제하지 못했습니다.');
  }
}
