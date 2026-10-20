import { getCommunityManagerAccess } from '@/lib/community/communityManager/utils';

type SessionCase = 'admin' | 'guest-public' | 'guest-site' | 'pending-member' | 'member' | 'staff';

type ManagerOnlyBoard = {
  write_permission?: string | null;
};

const COMMUNITY_MANAGER_ROLES = [
  'owner',
  'community-manager',
  'board-manager',
  'board-general-manager',
  'board-assistant-manager',
];

export function isManagerOnlyBoard(board: ManagerOnlyBoard) {
  return board.write_permission === 'manager';
}

export async function canAccessManagerOnlyBoards(siteName: string, sessionCase: SessionCase) {
  if (sessionCase === 'admin' || sessionCase === 'staff') {
    return true;
  }

  try {
    const access = await getCommunityManagerAccess(siteName, { requireManagerControlPermission: false });

    return access.actor.communityRoles.some((role) => COMMUNITY_MANAGER_ROLES.includes(role));
  } catch {
    return false;
  }
}

export async function getVisibleCommunityBoards<T extends ManagerOnlyBoard>(
  siteName: string,
  sessionCase: SessionCase,
  boards: T[],
) {
  if (!boards.some(isManagerOnlyBoard)) {
    return boards;
  }

  if (await canAccessManagerOnlyBoards(siteName, sessionCase)) {
    return boards;
  }

  return boards.filter((board) => !isManagerOnlyBoard(board));
}
