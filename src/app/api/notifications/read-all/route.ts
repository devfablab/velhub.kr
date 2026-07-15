import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function PATCH() {
  try {
    const session = await verifySession({
      siteId: null,
    });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const updateResult = await supabaseAdmin
      .from('notifications')
      .update({
        is_read: true,
      })
      .eq('user_id', session.authUserId)
      .eq('is_read', false);

    if (updateResult.error) {
      console.error(updateResult.error);

      return Response.json({ error: '전체 알림 읽음 처리에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
    });
  } catch (unknownError) {
    console.error(unknownError);

    return Response.json({ error: '전체 알림 읽음 처리에 실패했습니다.' }, { status: 500 });
  }
}
