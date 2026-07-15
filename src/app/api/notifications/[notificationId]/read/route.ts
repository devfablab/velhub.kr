import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    notificationId: string;
  }>;
};

export async function PATCH(_request: Request, context: RouteContext) {
  try {
    const { notificationId: rawNotificationId } = await context.params;
    const notificationId = normalizeText(rawNotificationId);

    if (!notificationId) {
      return Response.json({ error: 'notificationId가 유효하지 않습니다.' }, { status: 400 });
    }

    const session = await verifySession({
      siteId: null,
    });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const notificationResult = await supabaseAdmin
      .from('notifications')
      .select('id, is_read')
      .eq('id', notificationId)
      .eq('user_id', session.authUserId)
      .maybeSingle();

    if (notificationResult.error) {
      console.error(notificationResult.error);

      return Response.json({ error: '알림을 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!notificationResult.data) {
      return Response.json({ error: '알림을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!notificationResult.data.is_read) {
      const updateResult = await supabaseAdmin
        .from('notifications')
        .update({
          is_read: true,
        })
        .eq('id', notificationId)
        .eq('user_id', session.authUserId);

      if (updateResult.error) {
        console.error(updateResult.error);

        return Response.json({ error: '알림 읽음 처리에 실패했습니다.' }, { status: 500 });
      }
    }

    return Response.json({
      ok: true,
      id: notificationId,
      isRead: true,
    });
  } catch (unknownError) {
    console.error(unknownError);

    return Response.json({ error: '알림 읽음 처리에 실패했습니다.' }, { status: 500 });
  }
}
