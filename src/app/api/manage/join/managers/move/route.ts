import {
  buildCommunityManagerList,
  getCommunityManagerAccess,
  getCommunityManagerRows,
  type CommunityManagerAccess,
} from '@/lib/community/community-manager/utils';
import { NOTIFICATION_TYPE } from '@/lib/notifications/types';
import { normalizeText } from '@/lib/utils';

type RequestBody = {
  siteName?: string | null;
  action?:
    | 'move-board-general-manager'
    | 'move-board-general-manager-to-member'
    | 'move-manager-role'
    | 'move-manager-board'
    | 'move-manager-role-board'
    | null;
  sourceManageRoleId?: string | null;
  targetManageRoleId?: string | null;
  boardId?: string | null;
  role?: string | null;
  managerId?: string | null;
};

type CommunityManagerRole = 'community-manager' | 'board-manager' | 'board-general-manager' | 'board-assistant-manager';

type NotificationAction = 'assigned' | 'removed';

type ManagerNotification = {
  managerId: string;
  role: CommunityManagerRole;
  boardId: string | null;
  action: NotificationAction;
};

function isBoardRequiredRole(role: string) {
  return role === 'board-general-manager' || role === 'board-assistant-manager';
}

function isMoveRole(role: string): role is CommunityManagerRole {
  return (
    role === 'community-manager' ||
    role === 'board-manager' ||
    role === 'board-general-manager' ||
    role === 'board-assistant-manager'
  );
}

function getNotificationType(role: CommunityManagerRole, action: NotificationAction) {
  if (role === 'community-manager') {
    return action === 'assigned'
      ? NOTIFICATION_TYPE.COMMUNITY_MANAGER_ASSIGNED
      : NOTIFICATION_TYPE.COMMUNITY_MANAGER_REMOVED;
  }

  if (role === 'board-manager') {
    return action === 'assigned' ? NOTIFICATION_TYPE.BOARD_MANAGER_ASSIGNED : NOTIFICATION_TYPE.BOARD_MANAGER_REMOVED;
  }

  if (role === 'board-general-manager') {
    return action === 'assigned'
      ? NOTIFICATION_TYPE.BOARD_GENERAL_MANAGER_ASSIGNED
      : NOTIFICATION_TYPE.BOARD_GENERAL_MANAGER_REMOVED;
  }

  return action === 'assigned'
    ? NOTIFICATION_TYPE.BOARD_ASSISTANT_MANAGER_ASSIGNED
    : NOTIFICATION_TYPE.BOARD_ASSISTANT_MANAGER_REMOVED;
}

async function createManagerNotifications({
  access,
  notifications,
}: {
  access: CommunityManagerAccess;
  notifications: ManagerNotification[];
}) {
  if (notifications.length === 0) {
    return;
  }

  const managerIds = [...new Set(notifications.map((notification) => notification.managerId))];

  const membershipResult = await access.supabaseAdmin
    .from('rhizome_stigmas')
    .select('id, user_id')
    .eq('site_id', access.rhizome.id)
    .in('id', managerIds);

  if (membershipResult.error) {
    console.error(membershipResult.error);
    return;
  }

  const membershipMap = new Map((membershipResult.data ?? []).map((membership) => [membership.id, membership.user_id]));

  const stigmaIds = [...new Set([...Array.from(membershipMap.values()), access.actor.stigmaId])];

  const stigmaResult = await access.supabaseAdmin.from('stigmas').select('id, user_id').in('id', stigmaIds);

  if (stigmaResult.error) {
    console.error(stigmaResult.error);
    return;
  }

  const particleIdMap = new Map((stigmaResult.data ?? []).map((stigma) => [stigma.id, stigma.user_id]));

  const sendUserId = particleIdMap.get(access.actor.stigmaId) ?? null;

  const insertRows = notifications.flatMap((notification) => {
    const stigmaId = membershipMap.get(notification.managerId);
    const userId = stigmaId ? particleIdMap.get(stigmaId) : null;

    if (!userId) {
      return [];
    }

    return [
      {
        user_id: userId,
        send_user_id: sendUserId,
        send_site_id: access.rhizome.id,
        send_board_id: notification.boardId,
        send_series_id: null,
        send_post_id: null,
        notification_type: getNotificationType(notification.role, notification.action),
        is_read: false,
      },
    ];
  });

  if (insertRows.length === 0) {
    return;
  }

  const notificationResult = await access.supabaseAdmin.from('notifications').insert(insertRows);

  if (notificationResult.error) {
    console.error(notificationResult.error);
  }
}

export async function PATCH(request: Request) {
  try {
    const requestBody = (await request.json()) as RequestBody;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const action = normalizeText(requestBody.action);
    const sourceManageRoleId = normalizeText(requestBody.sourceManageRoleId);
    const targetManageRoleId = normalizeText(requestBody.targetManageRoleId);
    const boardId = normalizeText(requestBody.boardId);
    const role = normalizeText(requestBody.role);
    const managerId = normalizeText(requestBody.managerId);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!action) {
      return Response.json({ error: 'action이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!sourceManageRoleId) {
      return Response.json({ error: 'sourceManageRoleId가 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await getCommunityManagerAccess(siteName);
    const managerRows = await getCommunityManagerRows(access);
    const sourceRow = managerRows.find((row) => row.id === sourceManageRoleId);

    if (!sourceRow) {
      return Response.json({ error: '이동할 매니저 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const sourceRole = normalizeText(sourceRow.role);

    if (!isMoveRole(sourceRole)) {
      return Response.json({ error: '기존 역할이 유효하지 않습니다.' }, { status: 400 });
    }

    if (sourceRole === 'community-manager') {
      if (!access.actor.canManageCommunityManager) {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    } else if (!access.actor.canManageBoardManager) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    if (action === 'move-board-general-manager') {
      if (sourceRole !== 'board-general-manager') {
        return Response.json({ error: '개별 게시판 총괄 매니저만 이동할 수 있습니다.' }, { status: 400 });
      }

      if (!targetManageRoleId) {
        return Response.json({ error: 'targetManageRoleId가 유효하지 않습니다.' }, { status: 400 });
      }

      const targetRow = managerRows.find((row) => row.id === targetManageRoleId);

      if (!targetRow || normalizeText(targetRow.role) !== 'board-general-manager') {
        return Response.json({ error: '이동 대상 총괄 매니저를 찾을 수 없습니다.' }, { status: 404 });
      }

      const firstUpdate = await access.supabaseAdmin
        .from('community_manage_role')
        .update({
          board_id: targetRow.board_id,
          selected_at: new Date().toISOString(),
        })
        .eq('id', sourceRow.id)
        .eq('community_id', access.community.id);

      if (firstUpdate.error) {
        return Response.json({ error: '이동에 실패했습니다.' }, { status: 500 });
      }

      const secondUpdate = await access.supabaseAdmin
        .from('community_manage_role')
        .update({
          board_id: sourceRow.board_id,
          selected_at: new Date().toISOString(),
        })
        .eq('id', targetRow.id)
        .eq('community_id', access.community.id);

      if (secondUpdate.error) {
        return Response.json({ error: '이동에 실패했습니다.' }, { status: 500 });
      }

      await createManagerNotifications({
        access,
        notifications: [
          {
            managerId: sourceRow.manager_id,
            role: 'board-general-manager',
            boardId: sourceRow.board_id,
            action: 'removed',
          },
          {
            managerId: sourceRow.manager_id,
            role: 'board-general-manager',
            boardId: targetRow.board_id,
            action: 'assigned',
          },
          {
            managerId: targetRow.manager_id,
            role: 'board-general-manager',
            boardId: targetRow.board_id,
            action: 'removed',
          },
          {
            managerId: targetRow.manager_id,
            role: 'board-general-manager',
            boardId: sourceRow.board_id,
            action: 'assigned',
          },
        ],
      });

      const managers = await buildCommunityManagerList(access);

      return Response.json({
        ok: true,
        managers,
      });
    }

    if (action === 'move-board-general-manager-to-member') {
      if (sourceRole !== 'board-general-manager') {
        return Response.json({ error: '개별 게시판 총괄 매니저만 이동할 수 있습니다.' }, { status: 400 });
      }

      if (!managerId) {
        return Response.json({ error: 'managerId가 유효하지 않습니다.' }, { status: 400 });
      }

      const memberResult = await access.supabaseAdmin
        .from('rhizome_stigmas')
        .select('id, site_id, role, is_approval, is_block, kicked_at, banned_at')
        .eq('id', managerId)
        .eq('site_id', access.rhizome.id)
        .maybeSingle();

      if (memberResult.error || !memberResult.data) {
        return Response.json({ error: '대상 멤버를 찾을 수 없습니다.' }, { status: 404 });
      }

      if (normalizeText(memberResult.data.role) === 'owner') {
        return Response.json({ error: '운영자는 매니저로 변경할 수 없습니다.' }, { status: 400 });
      }

      if (
        memberResult.data.is_approval !== true ||
        memberResult.data.is_block === true ||
        memberResult.data.kicked_at ||
        memberResult.data.banned_at
      ) {
        return Response.json({ error: '이동할 수 없는 멤버입니다.' }, { status: 400 });
      }

      const duplicateTarget = managerRows.find(
        (row) =>
          row.manager_id === managerId &&
          normalizeText(row.role) === 'board-general-manager' &&
          normalizeText(row.board_id) === normalizeText(sourceRow.board_id),
      );

      if (duplicateTarget) {
        return Response.json({ error: '이미 해당 게시판의 총괄 매니저입니다.' }, { status: 400 });
      }

      const updateSource = await access.supabaseAdmin
        .from('community_manage_role')
        .update({
          manager_id: managerId,
          selected_at: new Date().toISOString(),
        })
        .eq('id', sourceRow.id)
        .eq('community_id', access.community.id);

      if (updateSource.error) {
        return Response.json({ error: '이동에 실패했습니다.' }, { status: 500 });
      }

      const updateNewManagerRoleResult = await access.supabaseAdmin
        .from('rhizome_stigmas')
        .update({
          role: 'manager',
        })
        .eq('id', managerId)
        .eq('site_id', access.rhizome.id)
        .neq('role', 'owner');

      if (updateNewManagerRoleResult.error) {
        return Response.json({ error: '멤버 역할 변경에 실패했습니다.' }, { status: 500 });
      }

      const previousRemainingRoleResult = await access.supabaseAdmin
        .from('community_manage_role')
        .select('id')
        .eq('community_id', access.community.id)
        .eq('manager_id', sourceRow.manager_id)
        .limit(1)
        .maybeSingle();

      if (previousRemainingRoleResult.error) {
        return Response.json({ error: '기존 매니저 역할 확인에 실패했습니다.' }, { status: 500 });
      }

      if (!previousRemainingRoleResult.data) {
        const updatePreviousManagerRoleResult = await access.supabaseAdmin
          .from('rhizome_stigmas')
          .update({
            role: 'member',
          })
          .eq('id', sourceRow.manager_id)
          .eq('site_id', access.rhizome.id)
          .neq('role', 'owner');

        if (updatePreviousManagerRoleResult.error) {
          return Response.json({ error: '멤버 역할 변경에 실패했습니다.' }, { status: 500 });
        }
      }

      await createManagerNotifications({
        access,
        notifications: [
          {
            managerId: sourceRow.manager_id,
            role: 'board-general-manager',
            boardId: sourceRow.board_id,
            action: 'removed',
          },
          {
            managerId,
            role: 'board-general-manager',
            boardId: sourceRow.board_id,
            action: 'assigned',
          },
        ],
      });

      const managers = await buildCommunityManagerList(access);

      return Response.json({
        ok: true,
        managers,
      });
    }

    if (action === 'move-manager-role' || action === 'move-manager-board' || action === 'move-manager-role-board') {
      if (!isMoveRole(role)) {
        return Response.json({ error: 'role이 유효하지 않습니다.' }, { status: 400 });
      }

      if (sourceRole === 'board-general-manager') {
        return Response.json({ error: '개별 게시판 총괄 매니저는 전용 이동으로 처리해야 합니다.' }, { status: 400 });
      }

      if (role === 'board-general-manager') {
        return Response.json({ error: '개별 게시판 총괄 매니저는 이동으로 처리해야 합니다.' }, { status: 400 });
      }

      if (role === 'community-manager') {
        if (!access.actor.canManageCommunityManager) {
          return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
        }
      } else if (!access.actor.canManageBoardManager) {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }

      if (isBoardRequiredRole(role) && !boardId) {
        return Response.json({ error: 'boardId가 유효하지 않습니다.' }, { status: 400 });
      }

      if (!isBoardRequiredRole(role) && boardId) {
        return Response.json({ error: 'boardId는 사용할 수 없습니다.' }, { status: 400 });
      }

      if (role === 'community-manager') {
        const currentCount = managerRows.filter(
          (row) => row.id !== sourceRow.id && normalizeText(row.role) === 'community-manager',
        ).length;

        if (currentCount >= access.planFeature.communityManagerLimit) {
          return Response.json({ error: '커뮤니티 매니저 자리가 없습니다.' }, { status: 400 });
        }
      }

      if (role === 'board-manager') {
        const currentCount = managerRows.filter(
          (row) => row.id !== sourceRow.id && normalizeText(row.role) === 'board-manager',
        ).length;

        if (currentCount >= access.planFeature.boardManagerLimit) {
          return Response.json({ error: '전체 게시판 매니저 자리가 없습니다.' }, { status: 400 });
        }
      }

      if (role === 'board-assistant-manager') {
        const boardResult = await access.supabaseAdmin
          .from('boards')
          .select('id')
          .eq('site_id', access.rhizome.id)
          .eq('id', boardId)
          .maybeSingle();

        if (boardResult.error || !boardResult.data) {
          return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
        }

        const currentCount = managerRows.filter(
          (row) =>
            row.id !== sourceRow.id &&
            normalizeText(row.role) === 'board-assistant-manager' &&
            normalizeText(row.board_id) === boardId,
        ).length;

        if (currentCount >= access.planFeature.boardAssistantManagerLimit) {
          return Response.json({ error: '해당 게시판의 부 매니저 자리가 꽉 찼습니다.' }, { status: 400 });
        }
      }

      const duplicateRow = managerRows.find(
        (row) =>
          row.id !== sourceRow.id &&
          row.manager_id === sourceRow.manager_id &&
          normalizeText(row.role) === role &&
          normalizeText(row.board_id) === (boardId || ''),
      );

      if (duplicateRow) {
        return Response.json({ error: '이미 동일한 매니저 권한이 있습니다.' }, { status: 400 });
      }

      const updateResult = await access.supabaseAdmin
        .from('community_manage_role')
        .update({
          role,
          board_id: boardId || null,
          selected_at: new Date().toISOString(),
        })
        .eq('id', sourceRow.id)
        .eq('community_id', access.community.id);

      if (updateResult.error) {
        return Response.json({ error: '이동에 실패했습니다.' }, { status: 500 });
      }

      const updateMemberRoleResult = await access.supabaseAdmin
        .from('rhizome_stigmas')
        .update({
          role: 'manager',
        })
        .eq('id', sourceRow.manager_id)
        .eq('site_id', access.rhizome.id)
        .neq('role', 'owner');

      if (updateMemberRoleResult.error) {
        return Response.json({ error: '멤버 역할 변경에 실패했습니다.' }, { status: 500 });
      }

      await createManagerNotifications({
        access,
        notifications: [
          {
            managerId: sourceRow.manager_id,
            role: sourceRole,
            boardId: sourceRow.board_id,
            action: 'removed',
          },
          {
            managerId: sourceRow.manager_id,
            role,
            boardId: boardId || null,
            action: 'assigned',
          },
        ],
      });

      const managers = await buildCommunityManagerList(access);

      return Response.json({
        ok: true,
        managers,
      });
    }

    return Response.json({ error: 'action이 유효하지 않습니다.' }, { status: 400 });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      const errorMessage = unknownError.message || '이동에 실패했습니다.';
      const status =
        errorMessage === 'siteName이 유효하지 않습니다.' ||
        errorMessage === 'action이 유효하지 않습니다.' ||
        errorMessage === 'sourceManageRoleId가 유효하지 않습니다.' ||
        errorMessage === 'targetManageRoleId가 유효하지 않습니다.' ||
        errorMessage === 'managerId가 유효하지 않습니다.' ||
        errorMessage === 'role이 유효하지 않습니다.' ||
        errorMessage === 'boardId가 유효하지 않습니다.'
          ? 400
          : errorMessage === '이동할 매니저 정보를 찾을 수 없습니다.' ||
              errorMessage === '이동 대상 총괄 매니저를 찾을 수 없습니다.' ||
              errorMessage === '대상 멤버를 찾을 수 없습니다.' ||
              errorMessage === '게시판을 찾을 수 없습니다.' ||
              errorMessage === '사이트를 찾을 수 없습니다.'
            ? 404
            : errorMessage === '접근 권한이 없습니다.'
              ? 403
              : 500;

      return Response.json({ error: errorMessage }, { status });
    }

    return Response.json({ error: '이동에 실패했습니다.' }, { status: 500 });
  }
}
