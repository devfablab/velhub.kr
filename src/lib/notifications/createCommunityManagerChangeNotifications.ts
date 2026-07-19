import type { CommunityManagerAccess } from '@/lib/community/community-manager/utils';
import { NOTIFICATION_TYPE } from '@/lib/notifications/types';

type ManagerChangeAction = 'assigned' | 'removed';

type ManagerRoleRow = {
  manager_id: string;
};

type MembershipRow = {
  id: string;
  user_id: string;
};

type StigmaRow = {
  id: string;
  user_id: string;
};

function getNotificationType(action: ManagerChangeAction) {
  return action === 'assigned'
    ? NOTIFICATION_TYPE.COMMUNITY_MANAGER_DELEGATED
    : NOTIFICATION_TYPE.COMMUNITY_MANAGER_DISMISSED;
}

export async function createCommunityManagerChangeNotifications({
  access,
  targetRhizomeStigmaId,
  action,
}: {
  access: CommunityManagerAccess;
  targetRhizomeStigmaId: string;
  action: ManagerChangeAction;
}) {
  const [managerRoleResult, ownerMembershipResult, targetMembershipResult] = await Promise.all([
    access.supabaseAdmin
      .from('community_manage_role')
      .select('manager_id')
      .eq('community_id', access.community.id),
    access.supabaseAdmin
      .from('rhizome_stigmas')
      .select('id, user_id')
      .eq('site_id', access.rhizome.id)
      .eq('role', 'owner'),
    access.supabaseAdmin
      .from('rhizome_stigmas')
      .select('id, user_id')
      .eq('site_id', access.rhizome.id)
      .eq('id', targetRhizomeStigmaId)
      .maybeSingle(),
  ]);

  if (
    managerRoleResult.error ||
    ownerMembershipResult.error ||
    targetMembershipResult.error ||
    !targetMembershipResult.data
  ) {
    console.error(
      managerRoleResult.error ?? ownerMembershipResult.error ?? targetMembershipResult.error,
    );
    return;
  }

  const managerIds = [
    ...new Set(((managerRoleResult.data ?? []) as ManagerRoleRow[]).map((managerRole) => managerRole.manager_id)),
  ];
  const managerMembershipResult =
    managerIds.length > 0
      ? await access.supabaseAdmin
          .from('rhizome_stigmas')
          .select('id, user_id')
          .eq('site_id', access.rhizome.id)
          .in('id', managerIds)
      : { data: [], error: null };

  if (managerMembershipResult.error) {
    console.error(managerMembershipResult.error);
    return;
  }

  const ownerMemberships = (ownerMembershipResult.data ?? []) as MembershipRow[];
  const managerMemberships = (managerMembershipResult.data ?? []) as MembershipRow[];
  const targetMembership = targetMembershipResult.data as MembershipRow;
  const recipientStigmaIds = [
    ...new Set([...ownerMemberships, ...managerMemberships].map((membership) => membership.user_id)),
  ];
  const stigmaIds = [...new Set([...recipientStigmaIds, targetMembership.user_id])];

  if (stigmaIds.length === 0) {
    return;
  }

  const stigmaResult = await access.supabaseAdmin.from('stigmas').select('id, user_id').in('id', stigmaIds);

  if (stigmaResult.error) {
    console.error(stigmaResult.error);
    return;
  }

  const particleIdMap = new Map(
    ((stigmaResult.data ?? []) as StigmaRow[]).map((stigma) => [stigma.id, stigma.user_id]),
  );
  const targetUserId = particleIdMap.get(targetMembership.user_id);

  if (!targetUserId) {
    return;
  }

  const recipientUserIds = [
    ...new Set(
      recipientStigmaIds
        .map((stigmaId) => particleIdMap.get(stigmaId))
        .filter((userId): userId is string => Boolean(userId) && userId !== access.actor.authUserId),
    ),
  ];

  if (recipientUserIds.length === 0) {
    return;
  }

  const notificationResult = await access.supabaseAdmin.from('notifications').insert(
    recipientUserIds.map((userId) => ({
      user_id: userId,
      send_user_id: access.actor.authUserId,
      target_id: targetUserId,
      send_site_id: access.rhizome.id,
      send_board_id: null,
      send_series_id: null,
      send_post_id: null,
      notification_type: getNotificationType(action),
      is_read: false,
    })),
  );

  if (notificationResult.error) {
    console.error(notificationResult.error);
  }
}
