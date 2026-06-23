import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type PaymentRow = {
  id: string;
  payment_type: string;
  target_type: string;
  target_id: string | null;
  order_no: string | null;
  amount: number;
  refunded_amount: number | null;
  currency: string | null;
  status: string;
  payment_method: string | null;
  approved_at: string | null;
  created_at: string;
  refundable_until: string | null;
  failure_message: string | null;
};

type BillingMethodRow = {
  id: string;
  provider: string;
  card_company: string | null;
  card_number_masked: string | null;
  card_type: string | null;
  owner_type: string | null;
  updated_at: string | null;
};

const SUCCESS_PAYMENT_STATUSES = ['paid', 'partially_refunded', 'refunded'];

function formatCardNumber(cardNumberMasked: string | null | undefined) {
  const normalizedCardNumber = normalizeText(cardNumberMasked).replace(/\D/g, '');

  if (normalizedCardNumber.length < 4) {
    return '카드번호 확인 필요';
  }

  return `${normalizedCardNumber.slice(0, 4)} ••••`;
}

function getPaymentTypeLabel(paymentType: string) {
  switch (paymentType) {
    case 'plan_billing':
      return '요금제';
    case 'membership_blog':
      return '멤버십';
    case 'subscription_board':
      return '게시판 구독';
    case 'subscription_series':
      return '연재 구독';
    case 'donation':
      return '후원';
    default:
      return '기타';
  }
}

function getPaymentStatusLabel(status: string) {
  switch (status) {
    case 'paid':
      return '결제 완료';
    case 'failed':
      return '결제 실패';
    case 'refunded':
      return '환불 완료';
    case 'partially_refunded':
      return '부분 환불';
    default:
      return '확인 필요';
  }
}

function getSummary(payments: PaymentRow[]) {
  const successPayments = payments.filter((payment) => SUCCESS_PAYMENT_STATUSES.includes(payment.status));

  const totalAmount = successPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalRefundedAmount = successPayments.reduce((sum, payment) => sum + (payment.refunded_amount ?? 0), 0);
  const netAmount = totalAmount - totalRefundedAmount;

  const amountByType = successPayments.reduce<Record<string, number>>((result, payment) => {
    result[payment.payment_type] =
      (result[payment.payment_type] ?? 0) + payment.amount - (payment.refunded_amount ?? 0);

    return result;
  }, {});

  return {
    totalAmount,
    totalRefundedAmount,
    netAmount,
    amountByType: Object.entries(amountByType).map(([paymentType, amount]) => ({
      paymentType,
      label: getPaymentTypeLabel(paymentType),
      amount,
    })),
  };
}

export async function GET() {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const [paymentsResult, billingMethodResult] = await Promise.all([
      supabaseAdmin
        .from('payments')
        .select(
          'id, payment_type, target_type, target_id, order_no, amount, refunded_amount, currency, status, payment_method, approved_at, created_at, refundable_until, failure_message',
        )
        .eq('buyer_user_id', session.authUserId)
        .order('created_at', { ascending: false })
        .limit(100),
      supabaseAdmin
        .from('subscription_billing_methods')
        .select('id, provider, card_company, card_number_masked, card_type, owner_type, updated_at')
        .eq('user_id', session.authUserId)
        .eq('is_default', true)
        .maybeSingle(),
    ]);

    if (paymentsResult.error) {
      console.error(paymentsResult.error);

      return Response.json({ error: '구입내역을 불러오지 못했습니다.' }, { status: 500 });
    }

    if (billingMethodResult.error) {
      console.error(billingMethodResult.error);

      return Response.json({ error: '결제수단을 불러오지 못했습니다.' }, { status: 500 });
    }

    const payments = (paymentsResult.data ?? []) as PaymentRow[];
    const defaultBillingMethod = billingMethodResult.data as BillingMethodRow | null;

    return Response.json({
      summary: getSummary(payments),
      defaultBillingMethod: defaultBillingMethod
        ? {
            id: defaultBillingMethod.id,
            provider: defaultBillingMethod.provider,
            cardCompany: defaultBillingMethod.card_company,
            cardNumberLabel: formatCardNumber(defaultBillingMethod.card_number_masked),
            cardType: defaultBillingMethod.card_type,
            ownerType: defaultBillingMethod.owner_type,
            updatedAt: defaultBillingMethod.updated_at,
          }
        : null,
      recentPayments: payments.slice(0, 10).map((payment) => ({
        id: payment.id,
        paymentType: payment.payment_type,
        paymentTypeLabel: getPaymentTypeLabel(payment.payment_type),
        targetType: payment.target_type,
        targetId: payment.target_id,
        orderNo: payment.order_no,
        amount: payment.amount,
        refundedAmount: payment.refunded_amount ?? 0,
        netAmount: payment.amount - (payment.refunded_amount ?? 0),
        currency: payment.currency ?? 'KRW',
        status: payment.status,
        statusLabel: getPaymentStatusLabel(payment.status),
        paymentMethod: payment.payment_method,
        approvedAt: payment.approved_at,
        createdAt: payment.created_at,
        refundableUntil: payment.refundable_until,
        failureMessage: payment.failure_message,
      })),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '구입내역을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '구입내역을 불러오지 못했습니다.' }, { status: 500 });
  }
}
