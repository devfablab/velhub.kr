import { getSupabaseAdmin } from '@/lib/supabase';
import { deleteMemberRestrictionMessages } from '@/lib/users/memberRestrictionMessagesServer';

function isValidCronRequest(request: Request) {
  if (process.env.NEXT_PUBLIC_APP_ENV === 'test') {
    return true;
  }

  const authorization = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    throw new Error('자동결제 실행 키가 설정되지 않았습니다.');
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

    const updateResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .update({
        kicked_at: null,
        kicked_by: null,
        kick_term: null,
        is_rejoin: true,
      })
      .not('kicked_at', 'is', null)
      .not('kick_term', 'is', null)
      .lte('kick_term', now)
      .select('id');

    if (updateResult.error) {
      console.error('[users/unkick] update error', updateResult.error);
      return Response.json({ error: '강제탈퇴 기간 만료 처리에 실패했습니다.' }, { status: 500 });
    }

    await deleteMemberRestrictionMessages({
      membershipIds: (updateResult.data ?? []).map((membership) => membership.id),
      restrictionTypes: ['kick'],
    });

    return Response.json({
      ok: true,
      count: updateResult.data?.length ?? 0,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        { error: unknownError.message || '강제탈퇴 기간 만료 처리에 실패했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ error: '강제탈퇴 기간 만료 처리에 실패했습니다.' }, { status: 500 });
  }
}
