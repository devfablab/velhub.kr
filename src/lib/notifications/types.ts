export const NOTIFICATION_TYPE = {
  BLOG_TEAM_INVITATION_SENT: 'blog_team_invitation_sent',
  COMMUNITY_MEMBER_INVITATION_SENT: 'community_member_invitation_sent',
  COMMUNITY_JOIN_REQUESTED: 'community_join_requested',
  COMMUNITY_JOIN_APPROVED: 'community_join_approved',
  COMMUNITY_JOIN_REJECTED: 'community_join_rejected',

  BLOG_MEMBER_PROMOTED_TO_MANAGER: 'blog_member_promoted_to_manager',
  BLOG_MANAGER_CHANGED_TO_MEMBER: 'blog_manager_changed_to_member',

  COMMUNITY_MANAGER_ASSIGNED: 'community_manager_assigned',
  COMMUNITY_MANAGER_REMOVED: 'community_manager_removed',
  BOARD_MANAGER_ASSIGNED: 'board_manager_assigned',
  BOARD_MANAGER_REMOVED: 'board_manager_removed',
  BOARD_GENERAL_MANAGER_ASSIGNED: 'board_general_manager_assigned',
  BOARD_GENERAL_MANAGER_REMOVED: 'board_general_manager_removed',
  BOARD_ASSISTANT_MANAGER_ASSIGNED: 'board_assistant_manager_assigned',
  BOARD_ASSISTANT_MANAGER_REMOVED: 'board_assistant_manager_removed',
  COMMUNITY_MANAGER_DELEGATED: 'community_manager_delegated',
  COMMUNITY_MANAGER_DISMISSED: 'community_manager_dismissed',

  REPORT_RECEIVED: 'report_received',
  REPORT_RESULT: 'report_result',
  VELHUB_SITE_BLOCKED: 'velhub_site_blocked',
  VELHUB_SITE_UNBLOCKED: 'velhub_site_unblocked',
  SITE_MEMBER_BLOCKED: 'site_member_blocked',
  SITE_MEMBER_UNBLOCKED: 'site_member_unblocked',
  COMMUNITY_MEMBER_KICKED: 'community_member_kicked',
  COMMUNITY_MEMBER_KICK_REVOKED: 'community_member_kick_revoked',
  COMMUNITY_MEMBER_BANNED: 'community_member_banned',
  COMMUNITY_MEMBER_BAN_REVOKED: 'community_member_ban_revoked',

  POST_COMMENTED: 'post_commented',
  POST_LIKED: 'post_liked',

  BOARD_SUBSCRIPTION_NEW_POST: 'board_subscription_new_post',
  SERIES_SUBSCRIPTION_NEW_POST: 'series_subscription_new_post',

  FAVORITE_BLOG_NEW_POST: 'favorite_blog_new_post',
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

export function isNotificationType(value: unknown): value is NotificationType {
  return (
    typeof value === 'string' && Object.values(NOTIFICATION_TYPE).some((notificationType) => notificationType === value)
  );
}
