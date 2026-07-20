import type { CommunityManagerAccess } from '@/lib/community/community-manager/utils';
import { PAYMENT_TARGET_TYPE, SUBSCRIPTION_TYPE } from '@/lib/payments/types';

const OWNER_TRANSFER_WAIT_MS = 30 * 24 * 60 * 60 * 1000;

type OwnerTransferRow = {
  previous_owner_id: string;
};

type AcceptedOwnerTransferRow = {
  responded_at: string | null;
};

export type OwnerTransferAvailability = {
  canRequest: boolean;
  hasPendingRequest: boolean;
  requesterRole: 'owner' | 'community-manager' | null;
  availableAt: string | null;
};

async function hasPastDuePlanBilling(access: CommunityManagerAccess) {
  const subscriptionResult = await access.supabaseAdmin
    .from('subscriptions')
    .select('status')
    .eq('subscription_type', SUBSCRIPTION_TYPE.PLAN_BILLING)
    .eq('target_type', PAYMENT_TARGET_TYPE.PLAN)
    .eq('target_id', access.rhizome.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscriptionResult.error) {
    throw new Error('요금제 결제 상태를 확인하지 못했습니다.');
  }

  return subscriptionResult.data?.status === 'past_due';
}

export async function getOwnerTransferAvailability(access: CommunityManagerAccess): Promise<OwnerTransferAvailability> {
  const isOwner = access.actor.communityRoles.includes('owner') && access.rhizome.owner_id === access.actor.stigmaId;
  const isCommunityManager = access.actor.communityRoles.includes('community-manager');

  if (!isOwner && !isCommunityManager) {
    return {
      canRequest: false,
      hasPendingRequest: false,
      requesterRole: null,
      availableAt: null,
    };
  }

  const pendingResult = await access.supabaseAdmin
    .from('owner_transfers')
    .select('id')
    .eq('site_id', access.rhizome.id)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle();

  if (pendingResult.error) {
    throw new Error('운영자 교체 요청을 확인하지 못했습니다.');
  }

  const hasPendingRequest = Boolean(pendingResult.data);

  if (isOwner) {
    const [firstRequestResult, acceptedRequestResult] = await Promise.all([
      access.supabaseAdmin
        .from('owner_transfers')
        .select('previous_owner_id')
        .eq('site_id', access.rhizome.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      access.supabaseAdmin
        .from('owner_transfers')
        .select('responded_at')
        .eq('site_id', access.rhizome.id)
        .eq('target_member_id', access.actor.rhizomeStigmaId)
        .eq('status', 'accepted')
        .order('responded_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (firstRequestResult.error || acceptedRequestResult.error) {
      throw new Error('운영자 교체 가능 시점을 확인하지 못했습니다.');
    }

    const firstRequest = firstRequestResult.data as OwnerTransferRow | null;
    const acceptedRequest = acceptedRequestResult.data as AcceptedOwnerTransferRow | null;
    const isOriginalOwner = !firstRequest || firstRequest.previous_owner_id === access.actor.stigmaId;
    const availableAt =
      !isOriginalOwner && acceptedRequest?.responded_at
        ? new Date(new Date(acceptedRequest.responded_at).getTime() + OWNER_TRANSFER_WAIT_MS).toISOString()
        : null;
    const hasWaitedLongEnough =
      isOriginalOwner || Boolean(availableAt && new Date(availableAt).getTime() <= Date.now());

    return {
      canRequest: !hasPendingRequest && hasWaitedLongEnough,
      hasPendingRequest,
      requesterRole: 'owner',
      availableAt,
    };
  }

  const hasPastDueBilling = await hasPastDuePlanBilling(access);

  return {
    canRequest: !hasPendingRequest && hasPastDueBilling,
    hasPendingRequest,
    requesterRole: hasPastDueBilling ? 'community-manager' : null,
    availableAt: null,
  };
}
