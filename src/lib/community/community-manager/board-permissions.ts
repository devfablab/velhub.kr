import type { CommunityManagePermissionMap } from '@/lib/community/community-manager/permissions';

type BoardPermissionCheckParams = {
  permissions: CommunityManagePermissionMap;
  managedBoardIds: string[];
  boardId: string;
};

type BoardMovePermissionCheckParams = {
  permissions: CommunityManagePermissionMap;
  managedBoardIds: string[];
  fromBoardId: string;
  toBoardId: string;
};

function isManagedBoard(managedBoardIds: string[], boardId: string) {
  return managedBoardIds.includes(boardId);
}

export function canMoveCommunityPost({
  permissions,
  managedBoardIds,
  fromBoardId,
  toBoardId,
}: BoardMovePermissionCheckParams) {
  if (permissions.all_board_post_move) return true;
  if (!permissions.managed_board_post_move) return false;

  return isManagedBoard(managedBoardIds, fromBoardId) || isManagedBoard(managedBoardIds, toBoardId);
}

export function canDeleteCommunityPost({ permissions, managedBoardIds, boardId }: BoardPermissionCheckParams) {
  if (permissions.all_board_post_delete) return true;
  if (!permissions.managed_board_post_delete) return false;

  return isManagedBoard(managedBoardIds, boardId);
}

export function canDeleteCommunityComment({ permissions, managedBoardIds, boardId }: BoardPermissionCheckParams) {
  if (permissions.all_board_comment_delete) return true;
  if (!permissions.managed_board_comment_delete) return false;

  return isManagedBoard(managedBoardIds, boardId);
}

export function canPinCommunityPost({ permissions, managedBoardIds, boardId }: BoardPermissionCheckParams) {
  if (permissions.all_board_post_pin) return true;
  if (!permissions.managed_board_post_pin) return false;

  return isManagedBoard(managedBoardIds, boardId);
}
