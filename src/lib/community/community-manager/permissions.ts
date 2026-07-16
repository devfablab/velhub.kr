import { normalizeText } from '@/lib/utils';

export type CommunityManageRoleType =
  | 'owner' // 운영자
  | 'community-manager' // 커뮤니티 매니저
  | 'board-manager' // 전체 게시판 매니저
  | 'board-general-manager' // 개별 게시판 총괄 매니저
  | 'board-assistant-manager'; // 개별 게시판 부 매니저

export type CommunityManagePermissionMap = {
  site_edit: boolean; // 사이트 정보 수정
  join_manage: boolean; // 가입 관리
  member_manage: boolean; // 멤버 관리
  page_manage: boolean; // 페이지 콘텐츠 관리

  all_board_post_move: boolean; // 모든 게시판 글 이동
  all_board_post_form_edit: boolean; // 모든 게시판 글 양식 수정
  all_board_post_delete: boolean; // 모든 게시판 글 삭제
  all_board_comment_delete: boolean; // 모든 게시판 댓글 삭제
  all_board_post_pin: boolean; // 모든 게시판 상단고정글 등록

  managed_board_post_move: boolean; // 담당 게시판 글 이동
  managed_board_post_form_edit: boolean; // 담당 게시판 글 양식 수정
  managed_board_post_delete: boolean; // 담당 게시판 글 삭제
  managed_board_comment_delete: boolean; // 담당 게시판 댓글 삭제
  managed_board_post_pin: boolean; // 담당 게시판 상단고정글 등록
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
  all_board_post_pin: false,

  managed_board_post_move: false,
  managed_board_post_form_edit: false,
  managed_board_post_delete: false,
  managed_board_comment_delete: false,
  managed_board_post_pin: false,
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
    all_board_post_pin: true,

    managed_board_post_move: true,
    managed_board_post_form_edit: true,
    managed_board_post_delete: true,
    managed_board_comment_delete: true,
    managed_board_post_pin: true,
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
    all_board_post_pin: true,

    managed_board_post_move: true,
    managed_board_post_form_edit: true,
    managed_board_post_delete: true,
    managed_board_comment_delete: true,
    managed_board_post_pin: true,
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
    all_board_post_pin: true,

    managed_board_post_move: true,
    managed_board_post_form_edit: true,
    managed_board_post_delete: true,
    managed_board_comment_delete: true,
    managed_board_post_pin: true,
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
    all_board_post_pin: false,

    managed_board_post_move: true,
    managed_board_post_form_edit: true,
    managed_board_post_delete: true,
    managed_board_comment_delete: true,
    managed_board_post_pin: true,
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
    all_board_post_pin: false,

    managed_board_post_move: false,
    managed_board_post_form_edit: false,
    managed_board_post_delete: true,
    managed_board_comment_delete: true,
    managed_board_post_pin: true,
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
        all_board_post_pin: accumulator.all_board_post_pin || currentPermission.all_board_post_pin,

        managed_board_post_move: accumulator.managed_board_post_move || currentPermission.managed_board_post_move,
        managed_board_post_form_edit:
          accumulator.managed_board_post_form_edit || currentPermission.managed_board_post_form_edit,
        managed_board_post_delete: accumulator.managed_board_post_delete || currentPermission.managed_board_post_delete,
        managed_board_comment_delete:
          accumulator.managed_board_comment_delete || currentPermission.managed_board_comment_delete,
        managed_board_post_pin: accumulator.managed_board_post_pin || currentPermission.managed_board_post_pin,
      };
    },
    { ...emptyPermissions },
  );
}
