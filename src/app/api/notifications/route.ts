import { decrypt } from '@/lib/encryption/decrypt';
import { getNotificationText } from '@/lib/notifications/messages';
import { isNotificationType, NOTIFICATION_TYPE } from '@/lib/notifications/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
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
  user_id: string;
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
  slug: number;
  subject: string | null;
};

type ReportMessageRow = {
  id: string;
  message: string;
  report_type: string;
  report_id: string;
  created_at: string;
};

function decryptUserName(value: string | null) {
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

function getNotificationHref({
  site,
  board,
  post,
}: {
  site: SiteRow | null;
  board: BoardRow | null;
  post: PostRow | null;
}) {
  if (!site) {
    return null;
  }

  if (board && post) {
    return `/${site.site_key}/${board.board_key}/${post.slug}`;
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

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const notificationsResult = await supabaseAdmin
      .from('notifications')
      .select(
        'id, created_at, user_id, send_user_id, target_id, send_site_id, send_board_id, send_series_id, send_post_id, notification_type, is_read',
      )
      .eq('user_id', session.authUserId)
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

    const [stigmasResult, sitesResult, boardsResult, seriesResult, postsResult, reportMessagesResult] =
      await Promise.all([
        notificationUserIds.length > 0
          ? supabaseAdmin.from('stigmas').select('user_id, user_name').in('user_id', notificationUserIds)
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
      reportMessagesResult.error
    ) {
      console.error(
        stigmasResult.error ??
          sitesResult.error ??
          boardsResult.error ??
          seriesResult.error ??
          postsResult.error ??
          reportMessagesResult.error,
      );

      return Response.json({ error: '알림 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const stigmaMap = new Map(
      ((stigmasResult.data ?? []) as StigmaRow[]).map((stigma) => [stigma.user_id, decryptUserName(stigma.user_name)]),
    );

    const siteMap = new Map(((sitesResult.data ?? []) as SiteRow[]).map((site) => [site.id, site]));

    const boardMap = new Map(((boardsResult.data ?? []) as BoardRow[]).map((board) => [board.id, board]));

    const seriesMap = new Map(((seriesResult.data ?? []) as SeriesRow[]).map((series) => [series.id, series]));

    const postMap = new Map(((postsResult.data ?? []) as PostRow[]).map((post) => [post.id, post]));

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

      const text = getNotificationText(notification.notification_type, {
        sendUserName: notification.send_user_id ? (stigmaMap.get(notification.send_user_id) ?? '') : '',
        targetUserName: notification.target_id ? (stigmaMap.get(notification.target_id) ?? '') : '',
        siteLabel: site?.site_label ?? null,
        boardLabel: board?.board_label ?? null,
        seriesLabel: series?.series_label ?? null,
        postSubject: post?.subject ?? null,
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
