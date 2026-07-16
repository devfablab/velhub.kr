import {
  buildCommunityManagerList,
  getCommunityManagerAccess,
  getCommunityManagerRows,
  type CommunityManagerAccess,
} from '@/lib/community-manager/utils';
import { NOTIFICATION_TYPE } from '@/lib/notifications/types';
import { normalizeText } from '@/lib/utils';

type RequestBody = {
  siteName?: string | null;
  manageRoleId?: string | null;
};

type CommunityManagerRole = 'community-manager' | 'board-manager' | 'board-general-manager' | 'board-assistant-manager';

function isCommunityManagerRole(value: string): value is CommunityManagerRole {
  return (
    value === 'community-manager' ||
    value === 'board-manager' ||
    value === 'board-general-manager' ||
    value === 'board-assistant-manager'
  );
}

function getRemovedNotificationType(role: CommunityManagerRole) {
  if (role === 'community-manager') {
    return NOTIFICATION_TYPE.COMMUNITY_MANAGER_REMOVED;
  }

  if (role === 'board-manager') {
    return NOTIFICATION_TYPE.BOARD_MANAGER_REMOVED;
  }

  if (role === 'board-general-manager') {
    return NOTIFICATION_TYPE.BOARD_GENERAL_MANAGER_REMOVED;
  }

  return NOTIFICATION_TYPE.BOARD_ASSISTANT_MANAGER_REMOVED;
}

async function createRemovedNotification({
  access,
  managerId,
  role,
  boardId,
}: {
  access: CommunityManagerAccess;
  managerId: string;
  role: CommunityManagerRole;
  boardId: string | null;
}) {
  const membershipResult = await access.supabaseAdmin
    .from('rhizome_stigmas')
    .select('user_id')
    .eq('id', managerId)
    .eq('site_id', access.rhizome.id)
    .maybeSingle();

  if (membershipResult.error || !membershipResult.data) {
    console.error(membershipResult.error);
    return;
  }

  const stigmaIds = [...new Set([membershipResult.data.user_id, access.actor.stigmaId])];

  const stigmaResult = await access.supabaseAdmin.from('stigmas').select('id, user_id').in('id', stigmaIds);

  if (stigmaResult.error) {
    console.error(stigmaResult.error);
    return;
  }

  const particleIdMap = new Map((stigmaResult.data ?? []).map((stigma) => [stigma.id, stigma.user_id]));

  const userId = particleIdMap.get(membershipResult.data.user_id);

  if (!userId) {
    return;
  }

  const notificationResult = await access.supabaseAdmin.from('notifications').insert({
    user_id: userId,
    send_user_id: particleIdMap.get(access.actor.stigmaId) ?? null,
    send_site_id: access.rhizome.id,
    send_board_id: boardId,
    send_series_id: null,
    send_post_id: null,
    notification_type: getRemovedNotificationType(role),
    is_read: false,
  });

  if (notificationResult.error) {
    console.error(notificationResult.error);
  }
}

export async function DELETE(request: Request) {
  try {
    const requestBody = (await request.json()) as RequestBody;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const manageRoleId = normalizeText(requestBody.manageRoleId);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!manageRoleId) {
      return Response.json({ error: 'manageRoleId가 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await getCommunityManagerAccess(siteName);
    const managerRows = await getCommunityManagerRows(access);
    const targetRow = managerRows.find((row) => row.id === manageRoleId);

    if (!targetRow) {
      return Response.json({ error: '매니저 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const targetRole = normalizeText(targetRow.role);

    if (!isCommunityManagerRole(targetRole)) {
      return Response.json({ error: '매니저 역할이 유효하지 않습니다.' }, { status: 400 });
    }

    if (targetRole === 'board-general-manager') {
      return Response.json({ error: '개별 게시판 총괄 매니저는 이동으로 처리해야 합니다.' }, { status: 400 });
    }

    if (targetRole === 'community-manager') {
      if (!access.actor.canManageCommunityManager) {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    } else if (!access.actor.canManageBoardManager) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const deleteResult = await access.supabaseAdmin
      .from('community_manage_role')
      .delete()
      .eq('id', targetRow.id)
      .eq('community_id', access.community.id);

    if (deleteResult.error) {
      return Response.json({ error: '해임에 실패했습니다.' }, { status: 500 });
    }

    const remainingRoleResult = await access.supabaseAdmin
      .from('community_manage_role')
      .select('id')
      .eq('community_id', access.community.id)
      .eq('manager_id', targetRow.manager_id)
      .limit(1)
      .maybeSingle();

    if (remainingRoleResult.error) {
      return Response.json({ error: '매니저 역할 확인에 실패했습니다.' }, { status: 500 });
    }

    if (!remainingRoleResult.data) {
      const updateMemberRoleResult = await access.supabaseAdmin
        .from('rhizome_stigmas')
        .update({
          role: 'member',
        })
        .eq('id', targetRow.manager_id)
        .eq('site_id', access.rhizome.id)
        .neq('role', 'owner');

      if (updateMemberRoleResult.error) {
        return Response.json({ error: '멤버 역할 변경에 실패했습니다.' }, { status: 500 });
      }
    }

    await createRemovedNotification({
      access,
      managerId: targetRow.manager_id,
      role: targetRole,
      boardId: targetRow.board_id,
    });

    const managers = await buildCommunityManagerList(access);

    return Response.json({
      ok: true,
      managers,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      const errorMessage = unknownError.message || '해임에 실패했습니다.';
      const status =
        errorMessage === 'siteName이 유효하지 않습니다.' || errorMessage === 'manageRoleId가 유효하지 않습니다.'
          ? 400
          : errorMessage === '매니저 정보를 찾을 수 없습니다.' || errorMessage === '사이트를 찾을 수 없습니다.'
            ? 404
            : errorMessage === '접근 권한이 없습니다.'
              ? 403
              : 500;

      return Response.json({ error: errorMessage }, { status });
    }

    return Response.json({ error: '해임에 실패했습니다.' }, { status: 500 });
  }
}
