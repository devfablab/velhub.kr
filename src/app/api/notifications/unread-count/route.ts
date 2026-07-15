import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const session = await verifySession({
      siteId: null,
    });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const countResult = await supabaseAdmin
      .from('notifications')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('user_id', session.authUserId)
      .eq('is_read', false);

    if (countResult.error) {
      console.error(countResult.error);

      return Response.json({ error: '읽지 않은 알림 개수를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      count: countResult.count ?? 0,
    });
  } catch (unknownError) {
    console.error(unknownError);

    return Response.json({ error: '읽지 않은 알림 개수를 불러오지 못했습니다.' }, { status: 500 });
  }
}
