import { getSupabaseAdmin } from '@/lib/supabase';
import {
  ACCOUNT_WITHDRAWAL_GRACE_MS,
  ACCOUNT_WITHDRAWAL_STATUS,
  completeAccountWithdrawal,
} from '@/lib/users/accountWithdrawalServer';

type PendingStigmaRow = {
  user_id: string;
};

function isValidCronRequest(request: Request) {
  if (process.env.NEXT_PUBLIC_APP_ENV === 'test') {
    return true;
  }

  const authorization = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    throw new Error('탈퇴 확정 실행 키가 설정되지 않았습니다.');
  }

  return authorization === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  try {
    if (!isValidCronRequest(request)) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const now = new Date();
    const nowIso = now.toISOString();
    const cutoffIso = new Date(now.getTime() - ACCOUNT_WITHDRAWAL_GRACE_MS).toISOString();
    const stigmasResult = await supabaseAdmin
      .from('stigmas')
      .select('user_id')
      .eq('withdrawal_status', ACCOUNT_WITHDRAWAL_STATUS.PENDING)
      .not('withdrawal_requested_at', 'is', null)
      .lte('withdrawal_requested_at', cutoffIso);

    if (stigmasResult.error) {
      throw new Error('탈퇴 확정 대상 계정을 확인하지 못했습니다.');
    }

    const stigmas = (stigmasResult.data ?? []) as PendingStigmaRow[];
    const completedUserIds: string[] = [];
    const failedUserIds: string[] = [];

    for (const stigma of stigmas) {
      try {
        await completeAccountWithdrawal({
          supabaseAdmin,
          authUserId: stigma.user_id,
          completedAt: nowIso,
        });
        completedUserIds.push(stigma.user_id);
      } catch (unknownError) {
        console.error(unknownError);
        failedUserIds.push(stigma.user_id);
      }
    }

    return Response.json({
      ok: failedUserIds.length === 0,
      completedCount: completedUserIds.length,
      failedCount: failedUserIds.length,
      failedUserIds,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '계정 탈퇴 확정 처리에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '계정 탈퇴 확정 처리에 실패했습니다.' }, { status: 500 });
  }
}
