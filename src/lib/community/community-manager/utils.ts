import { decrypt } from '@/lib/encryption/decrypt';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import {
  getMergedCommunityManagePermission,
  type CommunityManagePermissionMap,
  type CommunityManageRoleType,
  isCommunityManageRole,
} from '@/lib/community/community-manager/permissions';

type RhizomeRow = {
  id: string;
  site_key: string;
  site_type: string | null;
  plan_type: string | null;
};

type CommunityRow = {
  id: string;
  site_id: string;
};

type RhizomeStigmaRow = {
  id: string;
  user_id: string;
  role: string | null;
  nickname: string | null;
  is_approval: boolean;
  is_block: boolean;
  kicked_at: string | null;
  banned_at: string | null;
};

type CommunityManageRoleRow = {
  id: string;
  manager_id: string;
  board_id: string | null;
  community_id: string;
  role: string | null;
  selected_at: string | null;
  created_at: string;
};

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string | null;
};

type StigmaRow = {
  id: string;
  email: string | null;
  user_name: string | null;
};

type PlanFeatureRow = {
  count_manager: number | null;
  count_board_manager: number | null;
  count_board_general_manager: number | null;
  count_board_assistant_manager: number | null;
};

type GetCommunityManagerAccessOptions = {
  requireManagerControlPermission?: boolean;
};

export type ActiveMemberSummary = {
  rhizomeStigmaId: string;
  userId: string;
  nickname: string;
  email: string;
  userName: string;
};

export type CommunityManageBoardSummary = {
  boardId: string;
  boardKey: string;
  boardLabel: string;
  boardGeneralManagerCount: number;
  boardAssistantManagerCount: number;
  boardGeneralManagerLimit: number;
  boardAssistantManagerLimit: number;
  boardGeneralManagerFull: boolean;
  boardAssistantManagerFull: boolean;
};

export type CommunityManagerListItem = {
  manageRoleId: string;
  rhizomeStigmaId: string;
  userId: string;
  nickname: string;
  email: string;
  userName: string;
  role: CommunityManageRoleType;
  selectedAt: string | null;
  createdAt: string;
  boardId: string | null;
  boardKey: string | null;
  boardLabel: string | null;
};

export type CommunityManagerActor = {
  authUserId: string;
  stigmaId: string;
  rhizomeStigmaId: string;
  communityRoles: CommunityManageRoleType[];
  permissions: CommunityManagePermissionMap;
  managedBoardIds: string[];
  canManageCommunityManager: boolean;
  canManageBoardManager: boolean;
};

export type CommunityManagerAccess = {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  rhizome: RhizomeRow;
  community: CommunityRow;
  actor: CommunityManagerActor;
  planFeature: {
    communityManagerLimit: number;
    boardManagerLimit: number;
    boardGeneralManagerLimit: number;
    boardAssistantManagerLimit: number;
  };
};

function decryptNullable(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '';
  }

  try {
    return decrypt(normalizedValue);
  } catch {
    return '';
  }
}

function toNonNegativeInteger(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

export async function getCommunityManagerAccess(
  siteName: string,
  options: GetCommunityManagerAccessOptions = {},
): Promise<CommunityManagerAccess> {
  const normalizedSiteName = normalizeText(siteName).toLowerCase();

  if (!normalizedSiteName) {
    throw new Error('siteName이 유효하지 않습니다.');
  }

  const supabaseAdmin = getSupabaseAdmin();

  const rhizomeResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_type, plan_type')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (rhizomeResult.error || !rhizomeResult.data) {
    throw new Error('사이트를 찾을 수 없습니다.');
  }

  const rhizome = rhizomeResult.data as RhizomeRow;

  if (rhizome.site_type !== 'community') {
    throw new Error('커뮤니티만 사용할 수 있습니다.');
  }

  const communityResult = await supabaseAdmin
    .from('communities')
    .select('id, site_id')
    .eq('site_id', rhizome.id)
    .maybeSingle();

  if (communityResult.error || !communityResult.data) {
    throw new Error('커뮤니티 정보를 찾을 수 없습니다.');
  }

  const community = communityResult.data as CommunityRow;
  const session = await verifySession({ siteId: rhizome.id });

  if (!session.authUserId || !session.stigmaId || !session.rhizomeStigmaId) {
    throw new Error('접근 권한이 없습니다.');
  }

  const actorRhizomeStigmaResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('id, role')
    .eq('id', session.rhizomeStigmaId)
    .eq('site_id', rhizome.id)
    .maybeSingle();

  if (actorRhizomeStigmaResult.error || !actorRhizomeStigmaResult.data) {
    throw new Error('접근 권한이 없습니다.');
  }

  const actorBaseRole = normalizeText(actorRhizomeStigmaResult.data.role);

  const actorManageRoleResult = await supabaseAdmin
    .from('community_manage_role')
    .select('role, board_id')
    .eq('community_id', community.id)
    .eq('manager_id', session.rhizomeStigmaId);

  if (actorManageRoleResult.error) {
    throw new Error('접근 권한이 없습니다.');
  }

  const actorManageRoleRows = (actorManageRoleResult.data ?? []) as Pick<CommunityManageRoleRow, 'role' | 'board_id'>[];

  const actorManageRoles = actorManageRoleRows.map((row) => normalizeText(row.role)).filter(isCommunityManageRole);

  const mergedRoles: CommunityManageRoleType[] = [
    ...(actorBaseRole === 'owner' ? (['owner'] as CommunityManageRoleType[]) : []),
    ...actorManageRoles,
  ];

  const uniqueRoles = [...new Set(mergedRoles)];
  const permissions = getMergedCommunityManagePermission(uniqueRoles);

  const managedBoardIds = [
    ...new Set(
      actorManageRoleRows
        .filter((row) => ['board-general-manager', 'board-assistant-manager'].includes(normalizeText(row.role)))
        .map((row) => normalizeText(row.board_id))
        .filter(Boolean),
    ),
  ];

  const canManageCommunityManager = uniqueRoles.includes('owner');
  const canManageBoardManager = uniqueRoles.includes('owner') || uniqueRoles.includes('community-manager');

  if (options.requireManagerControlPermission !== false && !canManageCommunityManager && !canManageBoardManager) {
    throw new Error('접근 권한이 없습니다.');
  }

  const planFeatureResult = await supabaseAdmin
    .from('plan_features')
    .select('count_manager, count_board_manager, count_board_general_manager, count_board_assistant_manager')
    .eq('plan_id', rhizome.plan_type)
    .maybeSingle();

  if (planFeatureResult.error || !planFeatureResult.data) {
    throw new Error('플랜 정보를 찾을 수 없습니다.');
  }

  const planFeature = planFeatureResult.data as PlanFeatureRow;

  return {
    supabaseAdmin,
    rhizome,
    community,
    actor: {
      authUserId: session.authUserId,
      stigmaId: session.stigmaId,
      rhizomeStigmaId: session.rhizomeStigmaId,
      communityRoles: uniqueRoles,
      permissions,
      managedBoardIds,
      canManageCommunityManager,
      canManageBoardManager,
    },
    planFeature: {
      communityManagerLimit: toNonNegativeInteger(planFeature.count_manager),
      boardManagerLimit: toNonNegativeInteger(planFeature.count_board_manager),
      boardGeneralManagerLimit: toNonNegativeInteger(planFeature.count_board_general_manager),
      boardAssistantManagerLimit: toNonNegativeInteger(planFeature.count_board_assistant_manager),
    },
  };
}

export async function getCommunityManagerRows(access: CommunityManagerAccess) {
  const managerRoleResult = await access.supabaseAdmin
    .from('community_manage_role')
    .select('id, manager_id, board_id, community_id, role, selected_at, created_at')
    .eq('community_id', access.community.id)
    .order('created_at', { ascending: true });

  if (managerRoleResult.error) {
    throw new Error('매니저 정보를 불러오지 못했습니다.');
  }

  return (managerRoleResult.data ?? []) as CommunityManageRoleRow[];
}

export async function getActiveMembers(access: CommunityManagerAccess) {
  const activeMemberResult = await access.supabaseAdmin
    .from('rhizome_stigmas')
    .select('id, user_id, role, nickname, is_approval, is_block, kicked_at, banned_at')
    .eq('site_id', access.rhizome.id)
    .eq('is_approval', true)
    .eq('is_block', false)
    .is('kicked_at', null)
    .is('banned_at', null);

  if (activeMemberResult.error) {
    throw new Error('멤버 정보를 불러오지 못했습니다.');
  }

  const activeMembers = (activeMemberResult.data ?? []) as RhizomeStigmaRow[];
  const userIds = [...new Set(activeMembers.map((member) => member.user_id))];

  const stigmaResult =
    userIds.length > 0
      ? await access.supabaseAdmin.from('stigmas').select('id, email, user_name').in('id', userIds)
      : { data: [], error: null };

  if (stigmaResult.error) {
    throw new Error('멤버 정보를 불러오지 못했습니다.');
  }

  const stigmaMap = new Map(((stigmaResult.data ?? []) as StigmaRow[]).map((stigma) => [stigma.id, stigma]));

  return activeMembers.map<ActiveMemberSummary>((member) => {
    const stigma = stigmaMap.get(member.user_id) ?? null;

    return {
      rhizomeStigmaId: member.id,
      userId: member.user_id,
      nickname: normalizeText(member.nickname),
      email: decryptNullable(stigma?.email),
      userName: decryptNullable(stigma?.user_name),
    };
  });
}

export async function getBoardSummaries(access: CommunityManagerAccess, managerRows?: CommunityManageRoleRow[]) {
  const boardResult = await access.supabaseAdmin
    .from('boards')
    .select('id, board_key, board_label')
    .eq('site_id', access.rhizome.id)
    .order('board_key', { ascending: true });

  if (boardResult.error) {
    throw new Error('게시판 정보를 불러오지 못했습니다.');
  }

  const boards = (boardResult.data ?? []) as BoardRow[];
  const rows = managerRows ?? (await getCommunityManagerRows(access));

  return boards.map<CommunityManageBoardSummary>((board) => {
    const boardGeneralManagerCount = rows.filter(
      (row) => row.board_id === board.id && normalizeText(row.role) === 'board-general-manager',
    ).length;

    const boardAssistantManagerCount = rows.filter(
      (row) => row.board_id === board.id && normalizeText(row.role) === 'board-assistant-manager',
    ).length;

    return {
      boardId: board.id,
      boardKey: board.board_key,
      boardLabel: normalizeText(board.board_label) || board.board_key,
      boardGeneralManagerCount,
      boardAssistantManagerCount,
      boardGeneralManagerLimit: access.planFeature.boardGeneralManagerLimit,
      boardAssistantManagerLimit: access.planFeature.boardAssistantManagerLimit,
      boardGeneralManagerFull:
        access.planFeature.boardGeneralManagerLimit > 0 &&
        boardGeneralManagerCount >= access.planFeature.boardGeneralManagerLimit,
      boardAssistantManagerFull:
        access.planFeature.boardAssistantManagerLimit > 0 &&
        boardAssistantManagerCount >= access.planFeature.boardAssistantManagerLimit,
    };
  });
}

export async function buildCommunityManagerList(access: CommunityManagerAccess) {
  const managerRows = await getCommunityManagerRows(access);
  const activeMembers = await getActiveMembers(access);
  const activeMemberMap = new Map(activeMembers.map((member) => [member.rhizomeStigmaId, member]));
  const boardSummaries = await getBoardSummaries(access, managerRows);
  const boardMap = new Map(boardSummaries.map((board) => [board.boardId, board]));

  return managerRows
    .map<CommunityManagerListItem | null>((row) => {
      const manager = activeMemberMap.get(row.manager_id);

      if (!manager || !isCommunityManageRole(normalizeText(row.role))) {
        return null;
      }

      const board = row.board_id ? (boardMap.get(row.board_id) ?? null) : null;

      return {
        manageRoleId: row.id,
        rhizomeStigmaId: row.manager_id,
        userId: manager.userId,
        nickname: manager.nickname,
        email: manager.email,
        userName: manager.userName,
        role: normalizeText(row.role) as CommunityManageRoleType,
        selectedAt: row.selected_at,
        createdAt: row.created_at,
        boardId: board?.boardId ?? null,
        boardKey: board?.boardKey ?? null,
        boardLabel: board?.boardLabel ?? null,
      };
    })
    .filter((item): item is CommunityManagerListItem => Boolean(item));
}
