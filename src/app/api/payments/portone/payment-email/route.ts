import { encrypt } from '@/lib/encryption/encrypt';
import { getSupabaseAdmin } from '@/lib/supabase';
import verifySession from '@/lib/session/verifySession';
import { normalizeText } from '@/lib/utils';

type PaymentEmailRequestBody = {
  paymentEmail?: string;
};

const PAYMENT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const requestBody = (await request.json()) as PaymentEmailRequestBody;
    const paymentEmail = normalizeText(requestBody.paymentEmail).toLowerCase();

    if (!paymentEmail) {
      return Response.json({ error: '결제 이메일을 입력해 주세요.' }, { status: 400 });
    }

    if (!PAYMENT_EMAIL_PATTERN.test(paymentEmail)) {
      return Response.json({ error: '이메일 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const updateResult = await supabaseAdmin
      .from('stigmas')
      .update({
        payment_email: encrypt(paymentEmail),
      })
      .eq('user_id', session.authUserId)
      .select('id')
      .maybeSingle();

    if (updateResult.error) {
      console.error(updateResult.error);

      return Response.json({ error: '결제 이메일을 저장하지 못했습니다.' }, { status: 500 });
    }

    if (!updateResult.data) {
      return Response.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    return Response.json({
      paymentEmail,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '결제 이메일을 저장하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '결제 이메일을 저장하지 못했습니다.' }, { status: 500 });
  }
}
