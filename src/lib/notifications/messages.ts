import { NOTIFICATION_TYPE, type NotificationType } from '@/lib/notifications/types';
import { normalizeText } from '@/lib/utils';

export type NotificationMessageData = {
  sendUserName?: string | null;
  targetUserName?: string | null;
  siteLabel?: string | null;
  boardLabel?: string | null;
  seriesLabel?: string | null;
  postSubject?: string | null;
  reportMessage?: string | null;
};

export type NotificationText = {
  title: string;
  message: string;
};

function getText(value: string | null | undefined, fallback: string) {
  return normalizeText(value) || fallback;
}

export function getNotificationText(
  notificationType: NotificationType,
  data: NotificationMessageData,
): NotificationText {
  const sendUserName = getText(data.sendUserName, '사용자');
  const targetUserName = getText(data.targetUserName, '사용자');
  const siteLabel = getText(data.siteLabel, '사이트');
  const boardLabel = getText(data.boardLabel, '게시판');
  const seriesLabel = getText(data.seriesLabel, '연재');
  const postSubject = getText(data.postSubject, '글');
  const reportMessage = getText(data.reportMessage, '메시지 내용 없음');

  if (notificationType === NOTIFICATION_TYPE.BLOG_TEAM_INVITATION_SENT) {
    return {
      title: '블로그 팀원 초대',
      message: `${siteLabel} 블로그에서 팀원 초대장을 보냈습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.COMMUNITY_MEMBER_INVITATION_SENT) {
    return {
      title: '커뮤니티 멤버 초대',
      message: `${siteLabel} 커뮤니티에서 멤버 초대장을 보냈습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.COMMUNITY_JOIN_REQUESTED) {
    return {
      title: '새로운 가입 신청',
      message: `${siteLabel} 커뮤니티에 새로운 가입 신청이 있습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.COMMUNITY_JOIN_APPROVED) {
    return {
      title: '가입 신청 승인',
      message: `${siteLabel} 커뮤니티 가입 신청이 승인되었습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.COMMUNITY_JOIN_REJECTED) {
    return {
      title: '가입 신청 거절',
      message: `${siteLabel} 커뮤니티 가입 신청이 거절되었습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.BLOG_MEMBER_PROMOTED_TO_MANAGER) {
    return {
      title: '블로그 역할 변경',
      message: `${siteLabel} 블로그의 매니저로 변경되었습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.BLOG_MANAGER_CHANGED_TO_MEMBER) {
    return {
      title: '블로그 역할 변경',
      message: `${siteLabel} 블로그의 멤버로 변경되었습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.BLOG_MEMBER_CHANGED_TO_OBSERVER) {
    return {
      title: '블로그 팀원 자격 변경',
      message: `${siteLabel} 사이트에서 회원님의 팀원 자격에 대해 자격 정지 임시 처분을 하였습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.COMMUNITY_MANAGER_ASSIGNED) {
    return {
      title: '커뮤니티 매니저 위임',
      message: `${siteLabel} 커뮤니티의 커뮤니티 매니저로 위임되었습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.COMMUNITY_MANAGER_REMOVED) {
    return {
      title: '커뮤니티 매니저 해임',
      message: `${siteLabel} 커뮤니티의 커뮤니티 매니저에서 해임되었습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.BOARD_MANAGER_ASSIGNED) {
    return {
      title: '전체 게시판 매니저 위임',
      message: `${siteLabel} 커뮤니티의 전체 게시판 매니저로 위임되었습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.BOARD_MANAGER_REMOVED) {
    return {
      title: '전체 게시판 매니저 해임',
      message: `${siteLabel} 커뮤니티의 전체 게시판 매니저에서 해임되었습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.BOARD_GENERAL_MANAGER_ASSIGNED) {
    return {
      title: '게시판 총괄 매니저 위임',
      message: `${siteLabel}의 ${boardLabel} 게시판 총괄 매니저로 위임되었습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.BOARD_GENERAL_MANAGER_REMOVED) {
    return {
      title: '게시판 총괄 매니저 해임',
      message: `${siteLabel}의 ${boardLabel} 게시판 총괄 매니저에서 해임되었습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.BOARD_ASSISTANT_MANAGER_ASSIGNED) {
    return {
      title: '게시판 부 매니저 위임',
      message: `${siteLabel}의 ${boardLabel} 게시판 부 매니저로 위임되었습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.BOARD_ASSISTANT_MANAGER_REMOVED) {
    return {
      title: '게시판 부 매니저 해임',
      message: `${siteLabel}의 ${boardLabel} 게시판 부 매니저에서 해임되었습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.COMMUNITY_MANAGER_DELEGATED) {
    return {
      title: '매니저 위임',
      message: `${siteLabel}의 ${sendUserName}님이 ${targetUserName}님을 매니저로 위임했습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.COMMUNITY_MANAGER_DISMISSED) {
    return {
      title: '매니저 해임',
      message: `${siteLabel}의 ${sendUserName}님이 ${targetUserName}님을 매니저에서 해임했습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.SITE_OWNER_TRANSFER_REQUESTED) {
    return {
      title: '운영자 교체',
      message: `${siteLabel} 사이트에서 ${sendUserName} 님으로 부터 운영자 권한 요청이 도착했습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.SITE_OWNER_TRANSFER_REJECTED) {
    return {
      title: '운영자 교체 거부',
      message: `${siteLabel} 사이트에서 당신이 ${targetUserName} 님에게 요청한 운영자 권한 요청이 거부되었습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.REPORT_RECEIVED) {
    return {
      title: '새로운 신고 접수',
      message: `${siteLabel}에 새로운 신고가 접수되었습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.REPORT_RESULT) {
    return {
      title: '신고 처리 결과',
      message: `${siteLabel}의 ${boardLabel} 게시판 「${postSubject}」 글에 대한 신고 처리가 완료되었습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.CONCIERGE_REPORT_MESSAGE) {
    return {
      title: '데브허브 컨시어지팀 메시지',
      message: data.boardLabel
        ? `${siteLabel} 사이트의 ${boardLabel} 게시판에 대해 「${reportMessage}」 메시지를 데브허브 컨시어지팀에서 보냈습니다.`
        : `${siteLabel} 사이트에 대해 「${reportMessage}」 메시지를 데브허브 컨시어지팀에서 보냈습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.VELHUB_SITE_BLOCKED) {
    return {
      title: '사이트 이용 제한',
      message: `${siteLabel} 사이트가 벨허브 운영 정책에 따라 차단되었습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.VELHUB_SITE_UNBLOCKED) {
    return {
      title: '사이트 이용 제한 해제',
      message: `${siteLabel} 사이트의 벨허브 운영 정책에 따른 차단이 해제되었습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.SITE_MEMBER_BLOCKED) {
    return {
      title: '사이트 접근 차단',
      message: `${siteLabel} 사이트에서 접근이 차단되었습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.SITE_MEMBER_UNBLOCKED) {
    return {
      title: '사이트 접근 차단 해제',
      message: `${siteLabel} 사이트의 접근 차단이 해제되었습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.COMMUNITY_MEMBER_KICKED) {
    return {
      title: '커뮤니티 강제 탈퇴',
      message: `${siteLabel} 커뮤니티에서 강제 탈퇴되었습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.COMMUNITY_MEMBER_KICK_REVOKED) {
    return {
      title: '커뮤니티 강제 탈퇴 해제',
      message: `${siteLabel} 커뮤니티의 강제 탈퇴 처리가 해제되었습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.COMMUNITY_MEMBER_BANNED) {
    return {
      title: '커뮤니티 가입 불가',
      message: `${siteLabel} 커뮤니티에 가입할 수 없도록 처리되었습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.COMMUNITY_MEMBER_BAN_REVOKED) {
    return {
      title: '커뮤니티 가입 불가 해제',
      message: `${siteLabel} 커뮤니티의 가입 불가 처리가 해제되었습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.POST_COMMENTED) {
    return {
      title: '새 댓글',
      message: `${sendUserName}님이 「${postSubject}」 글에 댓글을 남겼습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.POST_LIKED) {
    return {
      title: '새 좋아요',
      message: `${sendUserName}님이 「${postSubject}」 글을 좋아합니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.BOARD_SUBSCRIPTION_NEW_POST) {
    return {
      title: '구독 게시판 새 글',
      message: `${siteLabel}의 ${boardLabel} 게시판에 「${postSubject}」 글이 올라왔습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.SERIES_SUBSCRIPTION_NEW_POST) {
    return {
      title: '구독 연재 새 글',
      message: `${siteLabel}의 ${seriesLabel} 연재에 「${postSubject}」 글이 올라왔습니다.`,
    };
  }

  return {
    title: '즐겨찾기 블로그 새 글',
    message: `${siteLabel} 블로그에 「${postSubject}」 글이 올라왔습니다.`,
  };
}
