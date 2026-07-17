import { NOTIFICATION_TYPE } from '@/lib/notifications/types';
import { getSupabaseAdmin } from '@/lib/supabase';

type PublishingPostRow = {
  id: string;
  user_id: string;
  site_id: string;
  board_id: string;
  series_id: string | null;
};

type RhizomeRow = {
  id: string;
  site_type: string;
};

type BlogFavoriteRow = {
  user_id: string;
  site_id: string;
};

function isValidCronRequest(request: Request) {
  if (process.env.NEXT_PUBLIC_APP_ENV === 'test') {
    return true;
  }

  const authorization = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    throw new Error('예약 출간 실행 키가 설정되지 않았습니다.');
  }

  return authorization === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  try {
    if (!isValidCronRequest(request)) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const now = new Date().toISOString();

    const postsResult = await supabaseAdmin
      .from('posts')
      .select('id, user_id, site_id, board_id, series_id')
      .eq('published_status', 'unknown')
      .not('published_at', 'is', null)
      .lte('published_at', now);

    if (postsResult.error) {
      return Response.json({ error: '예약 출간 글을 불러오지 못했습니다.' }, { status: 500 });
    }

    const posts = (postsResult.data ?? []) as PublishingPostRow[];

    if (posts.length === 0) {
      return Response.json({
        ok: true,
        publishedCount: 0,
        notificationCount: 0,
      });
    }

    const siteIds = [...new Set(posts.map((post) => post.site_id))];

    const rhizomesResult = await supabaseAdmin.from('rhizomes').select('id, site_type').in('id', siteIds);

    if (rhizomesResult.error) {
      return Response.json({ error: '사이트 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const blogSiteIds = new Set(
      ((rhizomesResult.data ?? []) as RhizomeRow[])
        .filter((rhizome) => rhizome.site_type === 'blog')
        .map((rhizome) => rhizome.id),
    );

    const blogPosts = posts.filter((post) => blogSiteIds.has(post.site_id));
    let notificationCount = 0;

    if (blogPosts.length > 0) {
      const favoritesResult = await supabaseAdmin
        .from('blog_favorites')
        .select('user_id, site_id')
        .in('site_id', [...blogSiteIds]);

      if (favoritesResult.error) {
        return Response.json({ error: '블로그 즐겨찾기 정보를 불러오지 못했습니다.' }, { status: 500 });
      }

      const favoriteUserIdsBySiteId = new Map<string, Set<string>>();

      for (const favorite of (favoritesResult.data ?? []) as BlogFavoriteRow[]) {
        const userIds = favoriteUserIdsBySiteId.get(favorite.site_id) ?? new Set<string>();
        userIds.add(favorite.user_id);
        favoriteUserIdsBySiteId.set(favorite.site_id, userIds);
      }

      const notificationRows = blogPosts.flatMap((post) => {
        const recipientUserIds = favoriteUserIdsBySiteId.get(post.site_id);

        if (!recipientUserIds) {
          return [];
        }

        return [...recipientUserIds].map((userId) => ({
          user_id: userId,
          send_user_id: post.user_id,
          send_site_id: post.site_id,
          send_board_id: post.board_id,
          send_series_id: post.series_id,
          send_post_id: post.id,
          notification_type: NOTIFICATION_TYPE.FAVORITE_BLOG_NEW_POST,
          is_read: false,
        }));
      });

      if (notificationRows.length > 0) {
        const notificationResult = await supabaseAdmin.from('notifications').insert(notificationRows);

        if (notificationResult.error) {
          return Response.json({ error: '예약 출간 알림 생성에 실패했습니다.' }, { status: 500 });
        }

        notificationCount = notificationRows.length;
      }
    }

    const postIds = posts.map((post) => post.id);

    const updateResult = await supabaseAdmin
      .from('posts')
      .update({
        published_status: 'published',
      })
      .in('id', postIds);

    if (updateResult.error) {
      return Response.json({ error: '예약 출간 처리에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      publishedCount: postIds.length,
      notificationCount,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '예약 출간 처리에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '예약 출간 처리에 실패했습니다.' }, { status: 500 });
  }
}
