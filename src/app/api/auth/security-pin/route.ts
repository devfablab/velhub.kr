import { getSecurityPinErrorMessage, normalizeSecurityPin } from '@/lib/auth/securityPin';
import { createSecurityPinHash } from '@/lib/auth/securityPin.server';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { getSessionClaims } from '@/lib/session/server';

type SecurityPinRequestBody = {
  pin?: string | null;
  pinConfirm?: string | null;
};

export async function GET() {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims?.userId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const stigmaResult = await getSupabaseAdmin()
      .from('stigmas')
      .select('security_pin_hash')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigmaResult.error) {
      return Response.json({ error: '보안 비밀번호 상태를 확인하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ hasSecurityPin: Boolean(stigmaResult.data?.security_pin_hash) });
  } catch {
    return Response.json({ error: '보안 비밀번호 상태를 확인하지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims?.userId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as SecurityPinRequestBody;
    const pin = normalizeSecurityPin(body.pin);
    const pinConfirm = normalizeSecurityPin(body.pinConfirm);
    const errorMessage = getSecurityPinErrorMessage(pin, pinConfirm);

    if (errorMessage) {
      return Response.json({ error: errorMessage }, { status: 400 });
    }

    const updateResult = await getSupabaseAdmin()
      .from('stigmas')
      .update({ security_pin_hash: createSecurityPinHash(sessionClaims.userId, pin) })
      .eq('user_id', sessionClaims.userId);

    if (updateResult.error) {
      return Response.json({ error: '보안 비밀번호를 저장하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ ok: true, hasSecurityPin: true });
  } catch {
    return Response.json({ error: '보안 비밀번호를 저장하지 못했습니다.' }, { status: 500 });
  }
}
