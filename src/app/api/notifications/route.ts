import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { isNotificationType, NOTIFICATION_TYPE, type NotificationType } from '@/lib/notifications/types';
import verifySession from '@/lib/session/verifySession';
import { normalizeText } from '@/lib/utils';

type NotificationRow = {
  id: string;
  created_at: string;
  user_id: string;
  send_user_id: string | null;
  target_id: string | null;
  send_site_id: string | null;
  send_board_id: string | null;
  send_series_id: string | null;
  send_post_id: string | null;
  notification_type: string;
  is_read: boolean;
};

type StigmaRow = {
  id: string;
  user_name: string | null;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
};

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string | null;
};

type SeriesRow = {
  id: string;
  series_key: string;
  series_label: string | null;
};

type PostRow = {
  id: string;
  slug: string;
  subject: string | null;
};

type BlogCommunityPostRow = {
  id: string;
  slug: string;
};

type ReportMessageRow = {
  id: string;
  message: string;
  report_type: string;
  report_id: string;
  created_at: string;
};
function decryptUserName(value: string) {
  const normalizedValue = normalizeText(value);
  try {
    return decrypt(normalizedValue);
  } catch {
    return '';
  }
}

function getNotificationHref({
  site,
  board,
  post,
  blogCommunityPost,
  notificationType,
}: {
  site: SiteRow | null;
  board: BoardRow | null;
  post: PostRow | null;
  blogCommunityPost: BlogCommunityPostRow | null;
  notificationType: string;
}) {
  if (notificationType === NOTIFICATION_TYPE.MEMBERSHIP_PAYMENT_FAILED) {
    return '/hub/purchase/memberships';
  }

  if (!site) {
    return null;
  }

  if (board && post) {
    return `/${site.site_key}/${board.board_key}/${post.slug}`;
  }

  if (blogCommunityPost) {
    return `/${site.site_key}/community-on-blog/${blogCommunityPost.slug}`;
  }

  if (board) {
    return `/${site.site_key}/${board.board_key}`;
  }

  return `/${site.site_key}`;
}

export async function GET() {
  try {
    const session = await verifySession({
      siteId: null,
    });

    if (!session.authUserId || !session.stigmaId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const notificationsResult = await supabaseAdmin
      .from('notifications')
      .select(
        'id, created_at, user_id, send_user_id, target_id, send_site_id, send_board_id, send_series_id, send_post_id, notification_type, is_read',
      )
      .eq('user_id', session.stigmaId)
      .order('created_at', { ascending: false });

    if (notificationsResult.error) {
      console.error(notificationsResult.error);

      return Response.json({ error: '알림 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const notifications = (notificationsResult.data ?? []) as NotificationRow[];

    const sendUserIds = [
      ...new Set(
        notifications
          .map((notification) => notification.send_user_id)
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    const targetUserIds = [
      ...new Set(
        notifications.map((notification) => notification.target_id).filter((value): value is string => Boolean(value)),
      ),
    ];

    const notificationUserIds = [...new Set([...sendUserIds, ...targetUserIds])];

    const siteIds = [
      ...new Set(
        notifications
          .map((notification) => notification.send_site_id)
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    const boardIds = [
      ...new Set(
        notifications
          .map((notification) => notification.send_board_id)
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    const seriesIds = [
      ...new Set(
        notifications
          .map((notification) => notification.send_series_id)
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    const postIds = [
      ...new Set(
        notifications
          .map((notification) => notification.send_post_id)
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    const reportMessageIds = [
      ...new Set(
        notifications
          .filter((notification) => notification.notification_type === NOTIFICATION_TYPE.CONCIERGE_REPORT_MESSAGE)
          .map((notification) => notification.target_id)
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    const [
      stigmasResult,
      sitesResult,
      boardsResult,
      seriesResult,
      postsResult,
      blogCommunityPostsResult,
      reportMessagesResult,
    ] = await Promise.all([
      notificationUserIds.length > 0
        ? supabaseAdmin.from('stigmas').select('id, user_name').in('id', notificationUserIds)
        : Promise.resolve({ data: [], error: null }),
      siteIds.length > 0
        ? supabaseAdmin.from('rhizomes').select('id, site_key, site_label').in('id', siteIds)
        : Promise.resolve({ data: [], error: null }),
      boardIds.length > 0
        ? supabaseAdmin.from('boards').select('id, board_key, board_label').in('id', boardIds)
        : Promise.resolve({ data: [], error: null }),
      seriesIds.length > 0
        ? supabaseAdmin.from('board_series').select('id, series_key, series_label').in('id', seriesIds)
        : Promise.resolve({ data: [], error: null }),
      postIds.length > 0
        ? supabaseAdmin.from('posts').select('id, slug, subject').in('id', postIds)
        : Promise.resolve({ data: [], error: null }),
      postIds.length > 0
        ? supabaseAdmin.from('blog_community_posts').select('id, slug').in('id', postIds)
        : Promise.resolve({ data: [], error: null }),
      reportMessageIds.length > 0
        ? supabaseAdmin
            .from('report_messages')
            .select('id, message, report_type, report_id, created_at')
            .in('id', reportMessageIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (
      stigmasResult.error ||
      sitesResult.error ||
      boardsResult.error ||
      seriesResult.error ||
      postsResult.error ||
      blogCommunityPostsResult.error ||
      reportMessagesResult.error
    ) {
      console.error(
        stigmasResult.error ??
          sitesResult.error ??
          boardsResult.error ??
          seriesResult.error ??
          postsResult.error ??
          blogCommunityPostsResult.error ??
          reportMessagesResult.error,
      );

      return Response.json({ error: '알림 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const stigmaMap = new Map(
      ((stigmasResult.data ?? []) as StigmaRow[]).map((stigma) => [stigma.id, decryptUserName(stigma.user_name || '')]),
    );

    const siteMap = new Map(((sitesResult.data ?? []) as SiteRow[]).map((site) => [site.id, site]));

    const boardMap = new Map(((boardsResult.data ?? []) as BoardRow[]).map((board) => [board.id, board]));

    const seriesMap = new Map(((seriesResult.data ?? []) as SeriesRow[]).map((series) => [series.id, series]));

    const postMap = new Map(((postsResult.data ?? []) as PostRow[]).map((post) => [post.id, post]));

    const blogCommunityPostMap = new Map(
      ((blogCommunityPostsResult.data ?? []) as BlogCommunityPostRow[]).map((post) => [post.id, post]),
    );

    const reportMessageMap = new Map(
      ((reportMessagesResult.data ?? []) as ReportMessageRow[]).map((reportMessage) => [
        reportMessage.id,
        reportMessage.message,
      ]),
    );

    const referencedReportMessages = (reportMessagesResult.data ?? []) as ReportMessageRow[];
    const reportMessageKeys = new Set(
      referencedReportMessages.map((reportMessage) => `${reportMessage.report_type}:${reportMessage.report_id}`),
    );
    const relatedReportMessagesResult =
      referencedReportMessages.length > 0
        ? await supabaseAdmin
            .from('report_messages')
            .select('id, message, report_type, report_id, created_at')
            .in('report_id', [...new Set(referencedReportMessages.map((reportMessage) => reportMessage.report_id))])
            .order('created_at', { ascending: true })
        : { data: [], error: null };

    if (relatedReportMessagesResult.error) {
      console.error(relatedReportMessagesResult.error);
      return Response.json({ error: '알림 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const reportMessageCountMap = new Map<string, number>();
    const countByReportKey = new Map<string, number>();

    for (const reportMessage of (relatedReportMessagesResult.data ?? []) as ReportMessageRow[]) {
      const reportKey = `${reportMessage.report_type}:${reportMessage.report_id}`;

      if (!reportMessageKeys.has(reportKey)) {
        continue;
      }

      const nextCount = (countByReportKey.get(reportKey) ?? 0) + 1;
      countByReportKey.set(reportKey, nextCount);
      reportMessageCountMap.set(reportMessage.id, nextCount);
    }

    const items = notifications.flatMap((notification) => {
      if (!isNotificationType(notification.notification_type)) {
        return [];
      }

      const site = notification.send_site_id ? (siteMap.get(notification.send_site_id) ?? null) : null;

      const board = notification.send_board_id ? (boardMap.get(notification.send_board_id) ?? null) : null;

      const series = notification.send_series_id ? (seriesMap.get(notification.send_series_id) ?? null) : null;

      const post = notification.send_post_id ? (postMap.get(notification.send_post_id) ?? null) : null;

      const blogCommunityPost = notification.send_post_id
        ? (blogCommunityPostMap.get(notification.send_post_id) ?? null)
        : null;

      const text = getNotificationText(notification.notification_type, {
        sendUserName: notification.send_user_id ? (stigmaMap.get(notification.send_user_id) ?? '') : '',
        targetUserName: notification.target_id ? (stigmaMap.get(notification.target_id) ?? '') : '',
        siteLabel: site?.site_label ?? null,
        boardLabel: board?.board_label ?? null,
        seriesLabel: series?.series_label ?? null,
        postSubject: post?.subject ?? (blogCommunityPost ? '커뮤니티 글' : null),
        reportMessage: notification.target_id ? (reportMessageMap.get(notification.target_id) ?? null) : null,
        reportMessageCount: notification.target_id ? (reportMessageCountMap.get(notification.target_id) ?? 0) : 0,
      });

      return [
        {
          id: notification.id,
          createdAt: notification.created_at,
          notificationType: notification.notification_type,
          title: text.title,
          message: text.message,
          href: getNotificationHref({
            site,
            board,
            post,
            blogCommunityPost,
            notificationType: notification.notification_type,
          }),
          isRead: notification.is_read,
        },
      ];
    });

    return Response.json({
      items,
    });
  } catch (unknownError) {
    console.error(unknownError);

    return Response.json({ error: '알림 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}

type NotificationMessageData = {
  sendUserName?: string | null;
  targetUserName?: string | null;
  siteLabel?: string | null;
  boardLabel?: string | null;
  seriesLabel?: string | null;
  postSubject?: string | null;
  reportMessage?: string | null;
  reportMessageCount?: number | null;
};

type NotificationText = {
  title: string;
  message: string;
};

function getText(value: string | null | undefined, fallback: string) {
  return normalizeText(value) || fallback;
}

function getNotificationText(notificationType: NotificationType, data: NotificationMessageData): NotificationText {
  const sendUserName = getText(data.sendUserName, '사용자');
  const targetUserName = getText(data.targetUserName, '사용자');
  const siteLabel = getText(data.siteLabel, '사이트');
  const boardLabel = getText(data.boardLabel, '게시판');
  const seriesLabel = getText(data.seriesLabel, '연재');
  const postSubject = getText(data.postSubject, '글');
  const reportMessage = getText(data.reportMessage, '메시지 내용 없음');
  const reportMessageCount = Math.max(0, Number(data.reportMessageCount ?? 0));
  const reportWarningStatus =
    reportMessageCount >= 3
      ? `현재까지 ${reportMessageCount}회 경고를 받았습니다. 경고가 3회 이상 누적되어 컨시어지팀의 사이트 차단 조치 대상이 되었습니다.`
      : `현재까지 ${reportMessageCount}회 경고를 받았습니다. 사이트 차단 조치까지 ${3 - reportMessageCount}회 남았습니다.`;

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
    const hasSite = Boolean(normalizeText(data.siteLabel));
    const hasBoard = Boolean(normalizeText(data.boardLabel));
    const hasPost = Boolean(normalizeText(data.postSubject));
    const reportTarget = hasPost
      ? hasBoard
        ? `${siteLabel}의 ${boardLabel} 게시판 「${postSubject}」 글에 대한 `
        : `${siteLabel}의 「${postSubject}」에 대한 `
      : hasBoard
        ? `${siteLabel}의 ${boardLabel} 게시판에 대한 `
        : hasSite
          ? `${siteLabel} 사이트에 대한 `
          : '접수하신 ';

    return {
      title: '신고 처리 결과',
      message: `${reportTarget}신고 처리가 완료되었습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.CONCIERGE_REPORT_MESSAGE) {
    return {
      title: '데브허브 컨시어지팀 메시지',
      message: data.boardLabel
        ? `${siteLabel} 사이트의 ${boardLabel} 게시판에 대해 「${reportMessage}」 메시지를 데브허브 컨시어지팀에서 보냈습니다. ${reportWarningStatus}`
        : `${siteLabel} 사이트에 대해 「${reportMessage}」 메시지를 데브허브 컨시어지팀에서 보냈습니다. ${reportWarningStatus}`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.CONCIERGE_SITE_BLOCKED) {
    return {
      title: '사이트 차단',
      message: `컨시어지팀에 의해 ${siteLabel} 사이트가 차단되었습니다. 이에 대해 운영자는 소명할 수 있습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.VELHUB_SITE_BLOCKED) {
    return {
      title: '사이트 이용 제한',
      message: `${siteLabel} 사이트가 데브허브 운영 정책에 따라 차단되었습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.VELHUB_SITE_UNBLOCKED) {
    return {
      title: '사이트 이용 제한 해제',
      message: `${siteLabel} 사이트의 데브허브 운영 정책에 따른 차단이 해제되었습니다.`,
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

  if (notificationType === NOTIFICATION_TYPE.SERIES_SUBSCRIPTION_NEW_POST) {
    return {
      title: '구독 연재 새 글',
      message: `${siteLabel}의 ${seriesLabel} 연재에 「${postSubject}」 글이 올라왔습니다.`,
    };
  }

  if (notificationType === NOTIFICATION_TYPE.MEMBERSHIP_PAYMENT_FAILED) {
    return {
      title: '멤버십 자동결제 실패',
      message: '자동결제가 완료되지 않았습니다. 결제수단을 확인해 주세요.',
    };
  }

  return {
    title: '즐겨찾기 블로그 새 글',
    message: `${siteLabel} 블로그에 「${postSubject}」 글이 올라왔습니다.`,
  };
}
