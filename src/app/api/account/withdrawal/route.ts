import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  cancelAccountWithdrawal,
  requestAccountWithdrawal,
} from '@/lib/users/accountWithdrawalServer';

export async function GET() {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims?.userId) {
      return Response.json({
        status: null,
        requestedAt: null,
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('withdrawal_requested_at, withdrawal_status')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigmaResult.error) {
      console.error('[account-withdrawal] status select error', stigmaResult.error);
      throw new Error('탈퇴 상태를 확인하지 못했습니다.');
    }

    return Response.json({
      status: stigmaResult.data?.withdrawal_status ?? null,
      requestedAt: stigmaResult.data?.withdrawal_requested_at ?? null,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '탈퇴 상태를 확인하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '탈퇴 상태를 확인하지 못했습니다.' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims?.userId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const result = await requestAccountWithdrawal(sessionClaims.userId);

    return Response.json({
      ok: true,
      ...result,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      const errorMessage = unknownError.message || '탈퇴 신청에 실패했습니다.';
      const status =
        errorMessage === '운영자 또는 매니저 역할을 하고 있는 사이트가 있어서 탈퇴 신청하실 수 없습니다.'
          ? 409
          : 500;

      return Response.json({ error: errorMessage }, { status });
    }

    return Response.json({ error: '탈퇴 신청에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims?.userId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const result = await cancelAccountWithdrawal(sessionClaims.userId);

    return Response.json({
      ok: true,
      ...result,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '탈퇴 신청 취소에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '탈퇴 신청 취소에 실패했습니다.' }, { status: 500 });
  }
}
