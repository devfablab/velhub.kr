import { encrypt } from '@/lib/encryption/encrypt';
import { decrypt } from '@/lib/encryption/decrypt';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type PaymentEmailRequestBody = {
  paymentEmail?: string;
  paymentPhone?: string;
};

const PAYMENT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId || !session.stigmaId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const requestBody = (await request.json()) as PaymentEmailRequestBody;
    const paymentEmail = normalizeText(requestBody.paymentEmail).toLowerCase();
    const paymentPhone = String(requestBody.paymentPhone ?? '').replace(/\D/g, '');

    if (paymentEmail && !PAYMENT_EMAIL_PATTERN.test(paymentEmail)) {
      return Response.json({ error: '이메일 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    if (paymentPhone && !/^01[0-9]{8,9}$/.test(paymentPhone)) {
      return Response.json({ error: '휴대폰 번호 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    if (!paymentEmail && !paymentPhone) {
      return Response.json({ error: '결제 이메일 또는 휴대폰 번호를 입력해 주세요.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const updateResult = await supabaseAdmin
      .from('stigmas')
      .update({
        ...(paymentEmail ? { payment_email: encrypt(paymentEmail) } : {}),
        ...(paymentPhone ? { payment_phone: encrypt(paymentPhone) } : {}),
      })
      .eq('id', session.stigmaId)
      .select('id, payment_email, payment_phone')
      .maybeSingle();

    if (updateResult.error) {
      console.error(updateResult.error);

      return Response.json({ error: '결제 이메일을 저장하지 못했습니다.' }, { status: 500 });
    }

    if (!updateResult.data) {
      return Response.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    return Response.json({
      paymentEmail: updateResult.data.payment_email ? decrypt(updateResult.data.payment_email) : '',
      paymentPhone: updateResult.data.payment_phone ? decrypt(updateResult.data.payment_phone).replace(/\D/g, '') : '',
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '결제 이메일을 저장하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '결제 이메일을 저장하지 못했습니다.' }, { status: 500 });
  }
}
