import { normalizeText } from '@/lib/utils';

export type CommunityManageRoleType =
  | 'owner'
  | 'community-manager'
  | 'board-manager'
  | 'board-general-manager'
  | 'board-assistant-manager';

export type CommunityManagePermissionMap = {
  site_edit: boolean;
  join_manage: boolean;
  member_manage: boolean;
  page_manage: boolean;
  all_board_post_move: boolean;
  all_board_post_form_edit: boolean;
  all_board_post_delete: boolean;
  all_board_comment_delete: boolean;
  all_board_notice_create: boolean;
  managed_board_post_move: boolean;
  managed_board_post_form_edit: boolean;
  managed_board_post_delete: boolean;
  managed_board_comment_delete: boolean;
  managed_board_notice_create: boolean;
};

const emptyPermissions: CommunityManagePermissionMap = {
  site_edit: false,
  join_manage: false,
  member_manage: false,
  page_manage: false,
  all_board_post_move: false,
  all_board_post_form_edit: false,
  all_board_post_delete: false,
  all_board_comment_delete: false,
  all_board_notice_create: false,
  managed_board_post_move: false,
  managed_board_post_form_edit: false,
  managed_board_post_delete: false,
  managed_board_comment_delete: false,
  managed_board_notice_create: false,
};

const permissionMap: Record<CommunityManageRoleType, CommunityManagePermissionMap> = {
  owner: {
    site_edit: true,
    join_manage: true,
    member_manage: true,
    page_manage: true,
    all_board_post_move: true,
    all_board_post_form_edit: true,
    all_board_post_delete: true,
    all_board_comment_delete: true,
    all_board_notice_create: true,
    managed_board_post_move: true,
    managed_board_post_form_edit: true,
    managed_board_post_delete: true,
    managed_board_comment_delete: true,
    managed_board_notice_create: true,
  },
  'community-manager': {
    site_edit: false,
    join_manage: true,
    member_manage: true,
    page_manage: true,
    all_board_post_move: true,
    all_board_post_form_edit: true,
    all_board_post_delete: true,
    all_board_comment_delete: true,
    all_board_notice_create: true,
    managed_board_post_move: true,
    managed_board_post_form_edit: true,
    managed_board_post_delete: true,
    managed_board_comment_delete: true,
    managed_board_notice_create: true,
  },
  'board-manager': {
    site_edit: false,
    join_manage: false,
    member_manage: false,
    page_manage: false,
    all_board_post_move: true,
    all_board_post_form_edit: true,
    all_board_post_delete: true,
    all_board_comment_delete: true,
    all_board_notice_create: true,
    managed_board_post_move: true,
    managed_board_post_form_edit: true,
    managed_board_post_delete: true,
    managed_board_comment_delete: true,
    managed_board_notice_create: true,
  },
  'board-general-manager': {
    site_edit: false,
    join_manage: false,
    member_manage: false,
    page_manage: false,
    all_board_post_move: false,
    all_board_post_form_edit: false,
    all_board_post_delete: false,
    all_board_comment_delete: false,
    all_board_notice_create: false,
    managed_board_post_move: true,
    managed_board_post_form_edit: true,
    managed_board_post_delete: true,
    managed_board_comment_delete: true,
    managed_board_notice_create: true,
  },
  'board-assistant-manager': {
    site_edit: false,
    join_manage: false,
    member_manage: false,
    page_manage: false,
    all_board_post_move: false,
    all_board_post_form_edit: false,
    all_board_post_delete: false,
    all_board_comment_delete: false,
    all_board_notice_create: false,
    managed_board_post_move: false,
    managed_board_post_form_edit: false,
    managed_board_post_delete: true,
    managed_board_comment_delete: true,
    managed_board_notice_create: true,
  },
};

export function isCommunityManageRole(value: string | null | undefined): value is CommunityManageRoleType {
  return (
    value === 'owner' ||
    value === 'community-manager' ||
    value === 'board-manager' ||
    value === 'board-general-manager' ||
    value === 'board-assistant-manager'
  );
}

export function getCommunityManagePermission(role: string | null | undefined) {
  const normalizedRole = normalizeText(role);

  if (!isCommunityManageRole(normalizedRole)) {
    return { ...emptyPermissions };
  }

  return { ...permissionMap[normalizedRole] };
}

export function getMergedCommunityManagePermission(roles: Array<string | null | undefined>) {
  return roles.reduce<CommunityManagePermissionMap>(
    (accumulator, role) => {
      const currentPermission = getCommunityManagePermission(role);

      return {
        site_edit: accumulator.site_edit || currentPermission.site_edit,
        join_manage: accumulator.join_manage || currentPermission.join_manage,
        member_manage: accumulator.member_manage || currentPermission.member_manage,
        page_manage: accumulator.page_manage || currentPermission.page_manage,
        all_board_post_move: accumulator.all_board_post_move || currentPermission.all_board_post_move,
        all_board_post_form_edit: accumulator.all_board_post_form_edit || currentPermission.all_board_post_form_edit,
        all_board_post_delete: accumulator.all_board_post_delete || currentPermission.all_board_post_delete,
        all_board_comment_delete: accumulator.all_board_comment_delete || currentPermission.all_board_comment_delete,
        all_board_notice_create: accumulator.all_board_notice_create || currentPermission.all_board_notice_create,
        managed_board_post_move: accumulator.managed_board_post_move || currentPermission.managed_board_post_move,
        managed_board_post_form_edit:
          accumulator.managed_board_post_form_edit || currentPermission.managed_board_post_form_edit,
        managed_board_post_delete: accumulator.managed_board_post_delete || currentPermission.managed_board_post_delete,
        managed_board_comment_delete:
          accumulator.managed_board_comment_delete || currentPermission.managed_board_comment_delete,
        managed_board_notice_create:
          accumulator.managed_board_notice_create || currentPermission.managed_board_notice_create,
      };
    },
    { ...emptyPermissions },
  );
}
