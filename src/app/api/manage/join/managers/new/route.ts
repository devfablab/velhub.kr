import {
  buildCommunityManagerList,
  getCommunityManagerAccess,
  getCommunityManagerRows,
  type CommunityManagerAccess,
} from '@/lib/community/community-manager/utils';
import { NOTIFICATION_TYPE } from '@/lib/notifications/types';
import { createCommunityManagerChangeNotifications } from '@/lib/notifications/createCommunityManagerChangeNotifications';
import { normalizeText } from '@/lib/utils';

type RequestBody = {
  siteName?: string | null;
  managerId?: string | null;
  role?: string | null;
  boardId?: string | null;
};

type CommunityManagerRole = 'community-manager' | 'board-manager' | 'board-general-manager' | 'board-assistant-manager';

function isBoardRequiredRole(role: string) {
  return role === 'board-general-manager' || role === 'board-assistant-manager';
}

function isAllowedNewRole(role: string): role is CommunityManagerRole {
  return (
    role === 'community-manager' ||
    role === 'board-manager' ||
    role === 'board-general-manager' ||
    role === 'board-assistant-manager'
  );
}

function getAssignedNotificationType(role: CommunityManagerRole) {
  if (role === 'community-manager') {
    return NOTIFICATION_TYPE.COMMUNITY_MANAGER_ASSIGNED;
  }

  if (role === 'board-manager') {
    return NOTIFICATION_TYPE.BOARD_MANAGER_ASSIGNED;
  }

  if (role === 'board-general-manager') {
    return NOTIFICATION_TYPE.BOARD_GENERAL_MANAGER_ASSIGNED;
  }

  return NOTIFICATION_TYPE.BOARD_ASSISTANT_MANAGER_ASSIGNED;
}

async function createAssignedNotification({
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
    notification_type: getAssignedNotificationType(role),
    is_read: false,
  });

  if (notificationResult.error) {
    console.error(notificationResult.error);
  }
}

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as RequestBody;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const managerId = normalizeText(requestBody.managerId);
    const role = normalizeText(requestBody.role);
    const boardId = normalizeText(requestBody.boardId);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!managerId) {
      return Response.json({ error: 'managerId가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!isAllowedNewRole(role)) {
      return Response.json({ error: 'role이 유효하지 않습니다.' }, { status: 400 });
    }

    if (isBoardRequiredRole(role) && !boardId) {
      return Response.json({ error: 'boardId가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!isBoardRequiredRole(role) && boardId) {
      return Response.json({ error: 'boardId는 사용할 수 없습니다.' }, { status: 400 });
    }

    const access = await getCommunityManagerAccess(siteName);
    const managerRows = await getCommunityManagerRows(access);

    if (role === 'community-manager') {
      if (!access.actor.canManageCommunityManager) {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    } else if (!access.actor.canManageBoardManager) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const memberResult = await access.supabaseAdmin
      .from('rhizome_stigmas')
      .select('id, site_id, role, is_approval, is_block, kicked_at, banned_at')
      .eq('id', managerId)
      .eq('site_id', access.rhizome.id)
      .maybeSingle();

    if (memberResult.error || !memberResult.data) {
      return Response.json({ error: '멤버를 찾을 수 없습니다.' }, { status: 404 });
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
      return Response.json({ error: '위임할 수 없는 멤버입니다.' }, { status: 400 });
    }

    const wasManager = normalizeText(memberResult.data.role) === 'manager';

    const duplicateRow = managerRows.find(
      (row) =>
        row.manager_id === managerId &&
        normalizeText(row.role) === role &&
        normalizeText(row.board_id) === (boardId || ''),
    );

    if (duplicateRow) {
      return Response.json({ error: '이미 동일한 매니저 권한이 있습니다.' }, { status: 400 });
    }

    if (role === 'community-manager') {
      const currentCount = managerRows.filter((row) => normalizeText(row.role) === 'community-manager').length;

      if (currentCount >= access.planFeature.communityManagerLimit) {
        return Response.json({ error: '커뮤니티 매니저 위임 가능 인원이 없습니다.' }, { status: 400 });
      }
    }

    if (role === 'board-manager') {
      const currentCount = managerRows.filter((row) => normalizeText(row.role) === 'board-manager').length;

      if (currentCount >= access.planFeature.boardManagerLimit) {
        return Response.json({ error: '전체 게시판 매니저 위임 가능 인원이 없습니다.' }, { status: 400 });
      }
    }

    if (role === 'board-assistant-manager') {
      const currentCount = managerRows.filter(
        (row) => normalizeText(row.role) === 'board-assistant-manager' && normalizeText(row.board_id) === boardId,
      ).length;

      if (currentCount >= access.planFeature.boardAssistantManagerLimit) {
        return Response.json({ error: '해당 게시판의 부 매니저 자리가 꽉 찼습니다.' }, { status: 400 });
      }

      const boardResult = await access.supabaseAdmin
        .from('boards')
        .select('id')
        .eq('site_id', access.rhizome.id)
        .eq('id', boardId)
        .maybeSingle();

      if (boardResult.error || !boardResult.data) {
        return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
      }
    }

    const insertResult = await access.supabaseAdmin
      .from('community_manage_role')
      .insert({
        manager_id: managerId,
        community_id: access.community.id,
        board_id: boardId || null,
        role,
        selected_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();

    if (insertResult.error || !insertResult.data) {
      return Response.json({ error: '위임에 실패했습니다.' }, { status: 500 });
    }

    const updateMemberRoleResult = await access.supabaseAdmin
      .from('rhizome_stigmas')
      .update({
        role: 'manager',
      })
      .eq('id', managerId)
      .eq('site_id', access.rhizome.id)
      .neq('role', 'owner');

    if (updateMemberRoleResult.error) {
      return Response.json({ error: '멤버 역할 변경에 실패했습니다.' }, { status: 500 });
    }

    await createAssignedNotification({
      access,
      managerId,
      role,
      boardId: boardId || null,
    });

    if (!wasManager) {
      await createCommunityManagerChangeNotifications({
        access,
        targetRhizomeStigmaId: managerId,
        action: 'assigned',
      });
    }

    const managers = await buildCommunityManagerList(access);

    return Response.json({
      ok: true,
      managers,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      const errorMessage = unknownError.message || '위임에 실패했습니다.';
      const status =
        errorMessage === 'siteName이 유효하지 않습니다.' ||
        errorMessage === 'managerId가 유효하지 않습니다.' ||
        errorMessage === 'role이 유효하지 않습니다.' ||
        errorMessage === 'boardId가 유효하지 않습니다.'
          ? 400
          : errorMessage === '사이트를 찾을 수 없습니다.' ||
              errorMessage === '멤버를 찾을 수 없습니다.' ||
              errorMessage === '게시판을 찾을 수 없습니다.'
            ? 404
            : errorMessage === '접근 권한이 없습니다.'
              ? 403
              : 500;

      return Response.json({ error: errorMessage }, { status });
    }

    return Response.json({ error: '위임에 실패했습니다.' }, { status: 500 });
  }
}
