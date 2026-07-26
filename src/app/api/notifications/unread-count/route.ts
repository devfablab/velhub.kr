import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const session = await verifySession({
      siteId: null,
    });

    if (!session.authUserId || !session.stigmaId) {
      return Response.json({
        count: 0,
      });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const countResult = await supabaseAdmin
      .from('notifications')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('user_id', session.stigmaId)
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
