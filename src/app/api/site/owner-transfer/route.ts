import { NOTIFICATION_TYPE } from '@/lib/notifications/types';
import { PAYMENT_TARGET_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type OwnerTransferResponseBody = {
  siteName?: string | null;
  transferId?: string | null;
  decision?: 'accepted' | 'rejected' | null;
};

type SiteRow = {
  id: string;
  owner_id: string;
  site_type: string | null;
};

type OwnerTransferRow = {
  id: string;
  requester_user_id: string;
  previous_owner_id: string;
  target_member_id: string;
};

type MembershipRow = {
  id: string;
  user_id: string;
  role: string | null;
  is_approval: boolean;
  is_block: boolean;
  kicked_at: string | null;
  banned_at: string | null;
  withdrawn_at: string | null;
};

type StigmaRow = {
  id: string;
  user_id: string;
};

type TargetRow = {
  id: string;
};

type SubscriptionRow = {
  id: string;
  target_type: string;
  target_id: string;
};

type ManagerRoleRow = {
  id: string;
  created_at: string;
  manager_id: string;
  board_id: string | null;
  community_id: string;
  role: string;
  selected_at: string | null;
};

async function getSite(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, owner_id, site_type')
    .eq('site_key', siteName)
    .maybeSingle();

  if (siteResult.error) {
    throw new Error('사이트 정보를 불러오지 못했습니다.');
  }

  if (!siteResult.data) {
    throw new Error('사이트를 찾을 수 없습니다.');
  }

  const site = siteResult.data as SiteRow;

  return { supabaseAdmin, site };
}

function isActiveTargetMembership(membership: MembershipRow) {
  return (
    membership.is_approval &&
    !membership.is_block &&
    !membership.kicked_at &&
    !membership.banned_at &&
    !membership.withdrawn_at
  );
}

async function getSiteSubscriptionIds({
  supabaseAdmin,
  siteId,
  ownerUserId,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  siteId: string;
  ownerUserId: string;
}) {
  const [subscriptionsResult, boardsResult, seriesResult] = await Promise.all([
    supabaseAdmin.from('subscriptions').select('id, target_type, target_id').eq('owner_user_id', ownerUserId),
    supabaseAdmin.from('boards').select('id').eq('site_id', siteId),
    supabaseAdmin.from('board_series').select('id').eq('site_id', siteId),
  ]);

  if (subscriptionsResult.error || boardsResult.error || seriesResult.error) {
    throw new Error('사이트 구독 소유 정보를 확인하지 못했습니다.');
  }

  const boardIds = new Set(((boardsResult.data ?? []) as TargetRow[]).map((row) => row.id));
  const seriesIds = new Set(((seriesResult.data ?? []) as TargetRow[]).map((row) => row.id));

  return ((subscriptionsResult.data ?? []) as SubscriptionRow[])
    .filter(
      (subscription) =>
        (subscription.target_type === PAYMENT_TARGET_TYPE.SITE && subscription.target_id === siteId) ||
        (subscription.target_type === PAYMENT_TARGET_TYPE.BOARD && boardIds.has(subscription.target_id)) ||
        (subscription.target_type === PAYMENT_TARGET_TYPE.SERIES && seriesIds.has(subscription.target_id)),
    )
    .map((subscription) => subscription.id);
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const { supabaseAdmin, site } = await getSite(siteName);

    if (site.site_type !== 'community') {
      return Response.json({ transfer: null });
    }

    const session = await verifySession({ siteId: site.id });

    if (!session.authUserId || !session.rhizomeStigmaId) {
      return Response.json({ transfer: null });
    }

    const transferResult = await supabaseAdmin
      .from('owner_transfers')
      .select('id, created_at')
      .eq('site_id', site.id)
      .eq('target_member_id', session.rhizomeStigmaId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (transferResult.error) {
      throw new Error('운영자 교체 요청을 불러오지 못했습니다.');
    }

    return Response.json({ transfer: transferResult.data ?? null });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      const status = unknownError.message === '사이트를 찾을 수 없습니다.' ? 404 : 500;
      return Response.json({ error: unknownError.message || '운영자 교체 요청을 불러오지 못했습니다.' }, { status });
    }

    return Response.json({ error: '운영자 교체 요청을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as OwnerTransferResponseBody;
    const siteName = normalizeText(body.siteName).toLowerCase();
    const transferId = normalizeText(body.transferId);
    const decision = body.decision;

    if (!siteName || !transferId || (decision !== 'accepted' && decision !== 'rejected')) {
      return Response.json({ error: '운영자 교체 응답이 유효하지 않습니다.' }, { status: 400 });
    }

    const { supabaseAdmin, site } = await getSite(siteName);

    if (site.site_type !== 'community') {
      return Response.json({ error: '커뮤니티만 사용할 수 있습니다.' }, { status: 400 });
    }

    const session = await verifySession({ siteId: site.id });

    if (!session.authUserId || !session.stigmaId || !session.rhizomeStigmaId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const transferResult = await supabaseAdmin
      .from('owner_transfers')
      .select('id, requester_user_id, previous_owner_id, target_member_id')
      .eq('id', transferId)
      .eq('site_id', site.id)
      .eq('target_member_id', session.rhizomeStigmaId)
      .eq('status', 'pending')
      .maybeSingle();

    if (transferResult.error) {
      throw new Error('운영자 교체 요청을 확인하지 못했습니다.');
    }

    if (!transferResult.data) {
      return Response.json({ error: '처리할 운영자 교체 요청이 없습니다.' }, { status: 404 });
    }

    const transfer = transferResult.data as OwnerTransferRow;
    const nowIso = new Date().toISOString();

    if (decision === 'rejected') {
      const rejectResult = await supabaseAdmin
        .from('owner_transfers')
        .update({ status: 'rejected', responded_at: nowIso })
        .eq('id', transfer.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (rejectResult.error || !rejectResult.data) {
        throw new Error('운영자 교체 요청을 거절하지 못했습니다.');
      }

      const notificationResult = await supabaseAdmin.from('notifications').insert({
        user_id: transfer.requester_user_id,
        send_user_id: session.authUserId,
        target_id: session.authUserId,
        send_site_id: site.id,
        send_board_id: null,
        send_series_id: null,
        send_post_id: null,
        notification_type: NOTIFICATION_TYPE.SITE_OWNER_TRANSFER_REJECTED,
        is_read: false,
      });

      if (notificationResult.error) {
        console.error(notificationResult.error);

        const restoreResult = await supabaseAdmin
          .from('owner_transfers')
          .update({ status: 'pending', responded_at: null })
          .eq('id', transfer.id)
          .eq('status', 'rejected');

        if (restoreResult.error) {
          console.error(restoreResult.error);
        }

        throw new Error('운영자 교체 거절 알림을 보내지 못했습니다.');
      }

      return Response.json({ ok: true, decision });
    }

    if (site.owner_id !== transfer.previous_owner_id) {
      return Response.json({ error: '사이트 운영자가 이미 변경되었습니다.' }, { status: 409 });
    }

    const [targetMembershipResult, previousOwnerMembershipResult, stigmaResult, siteOwnerResult, managerRolesResult] =
      await Promise.all([
        supabaseAdmin
          .from('rhizome_stigmas')
          .select('id, user_id, role, is_approval, is_block, kicked_at, banned_at, withdrawn_at')
          .eq('id', transfer.target_member_id)
          .eq('site_id', site.id)
          .maybeSingle(),
        supabaseAdmin
          .from('rhizome_stigmas')
          .select('id, user_id, role, is_approval, is_block, kicked_at, banned_at, withdrawn_at')
          .eq('site_id', site.id)
          .eq('user_id', transfer.previous_owner_id)
          .eq('role', 'owner')
          .maybeSingle(),
        supabaseAdmin.from('stigmas').select('id, user_id').in('id', [transfer.previous_owner_id, session.stigmaId]),
        supabaseAdmin.from('sites').select('id, owner_id').eq('site_id', site.id).maybeSingle(),
        supabaseAdmin
          .from('community_manage_role')
          .select('id, created_at, manager_id, board_id, community_id, role, selected_at')
          .eq('manager_id', transfer.target_member_id),
      ]);

    if (
      targetMembershipResult.error ||
      previousOwnerMembershipResult.error ||
      stigmaResult.error ||
      siteOwnerResult.error ||
      managerRolesResult.error
    ) {
      throw new Error('운영자 교체에 필요한 정보를 확인하지 못했습니다.');
    }

    if (!targetMembershipResult.data || !previousOwnerMembershipResult.data || !siteOwnerResult.data) {
      return Response.json({ error: '운영자 교체 대상 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const targetMembership = targetMembershipResult.data as MembershipRow;
    const previousOwnerMembership = previousOwnerMembershipResult.data as MembershipRow;

    if (targetMembership.user_id !== session.stigmaId || !isActiveTargetMembership(targetMembership)) {
      return Response.json({ error: '현재 운영자 요청을 수락할 수 없습니다.' }, { status: 403 });
    }

    const stigmaMap = new Map(((stigmaResult.data ?? []) as StigmaRow[]).map((stigma) => [stigma.id, stigma.user_id]));
    const previousOwnerUserId = stigmaMap.get(transfer.previous_owner_id);
    const targetUserId = stigmaMap.get(targetMembership.user_id);

    if (!previousOwnerUserId || !targetUserId || siteOwnerResult.data.owner_id !== previousOwnerUserId) {
      return Response.json({ error: '사이트 운영자 연결 정보가 일치하지 않습니다.' }, { status: 409 });
    }

    const subscriptionIds = await getSiteSubscriptionIds({
      supabaseAdmin,
      siteId: site.id,
      ownerUserId: previousOwnerUserId,
    });
    const managerRoles = (managerRolesResult.data ?? []) as ManagerRoleRow[];

    async function rollback() {
      const rollbackResults = await Promise.all([
        supabaseAdmin.from('rhizomes').update({ owner_id: transfer.previous_owner_id }).eq('id', site.id),
        supabaseAdmin.from('sites').update({ owner_id: previousOwnerUserId }).eq('site_id', site.id),
        supabaseAdmin
          .from('rhizome_stigmas')
          .update({ role: previousOwnerMembership.role })
          .eq('id', previousOwnerMembership.id),
        supabaseAdmin.from('rhizome_stigmas').update({ role: targetMembership.role }).eq('id', targetMembership.id),
        subscriptionIds.length > 0
          ? supabaseAdmin.from('subscriptions').update({ owner_user_id: previousOwnerUserId }).in('id', subscriptionIds)
          : Promise.resolve({ error: null }),
        managerRoles.length > 0
          ? supabaseAdmin.from('community_manage_role').upsert(managerRoles, { onConflict: 'id' })
          : Promise.resolve({ error: null }),
      ]);

      const rollbackError = rollbackResults.find((result) => result.error)?.error;

      if (rollbackError) {
        console.error(rollbackError);
      }
    }

    const subscriptionUpdateResult =
      subscriptionIds.length > 0
        ? await supabaseAdmin.from('subscriptions').update({ owner_user_id: targetUserId }).in('id', subscriptionIds)
        : { error: null };

    if (subscriptionUpdateResult.error) {
      throw new Error('구독 소유자를 변경하지 못했습니다.');
    }

    const siteOwnerUpdateResult = await supabaseAdmin
      .from('sites')
      .update({ owner_id: targetUserId })
      .eq('site_id', site.id)
      .eq('owner_id', previousOwnerUserId)
      .select('id')
      .maybeSingle();

    if (siteOwnerUpdateResult.error || !siteOwnerUpdateResult.data) {
      await rollback();
      throw new Error('사이트 운영자 연결을 변경하지 못했습니다.');
    }

    const rhizomeUpdateResult = await supabaseAdmin
      .from('rhizomes')
      .update({ owner_id: targetMembership.user_id })
      .eq('id', site.id)
      .eq('owner_id', transfer.previous_owner_id)
      .select('id')
      .maybeSingle();

    if (rhizomeUpdateResult.error || !rhizomeUpdateResult.data) {
      await rollback();
      throw new Error('사이트 운영자를 변경하지 못했습니다.');
    }

    const previousRoleUpdateResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .update({ role: 'member' })
      .eq('id', previousOwnerMembership.id)
      .eq('role', 'owner')
      .select('id')
      .maybeSingle();

    if (previousRoleUpdateResult.error || !previousRoleUpdateResult.data) {
      await rollback();
      throw new Error('기존 운영자 역할을 변경하지 못했습니다.');
    }

    const targetRoleUpdateResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .update({ role: 'owner' })
      .eq('id', targetMembership.id)
      .select('id')
      .maybeSingle();

    if (targetRoleUpdateResult.error || !targetRoleUpdateResult.data) {
      await rollback();
      throw new Error('새 운영자 역할을 변경하지 못했습니다.');
    }

    if (managerRoles.length > 0) {
      const managerRoleDeleteResult = await supabaseAdmin
        .from('community_manage_role')
        .delete()
        .in(
          'id',
          managerRoles.map((role) => role.id),
        );

      if (managerRoleDeleteResult.error) {
        await rollback();
        throw new Error('새 운영자의 기존 매니저 역할을 정리하지 못했습니다.');
      }
    }

    const acceptResult = await supabaseAdmin
      .from('owner_transfers')
      .update({ status: 'accepted', responded_at: nowIso })
      .eq('id', transfer.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (acceptResult.error || !acceptResult.data) {
      await rollback();
      throw new Error('운영자 교체 요청을 완료하지 못했습니다.');
    }

    return Response.json({ ok: true, decision });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      const errorMessage = unknownError.message || '운영자 교체 요청 처리에 실패했습니다.';
      const status =
        errorMessage === '사이트를 찾을 수 없습니다.' ? 404 : errorMessage === '로그인이 필요합니다.' ? 401 : 500;

      return Response.json({ error: errorMessage }, { status });
    }

    return Response.json({ error: '운영자 교체 요청 처리에 실패했습니다.' }, { status: 500 });
  }
}
