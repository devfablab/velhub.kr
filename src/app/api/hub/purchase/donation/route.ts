import { PAYMENT_TARGET_TYPE, PAYMENT_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';

type PaymentRow = {
  id: string;
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

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
  site_type: string;
};

const SUCCESS_PAYMENT_STATUSES = ['paid', 'partially_refunded', 'refunded'];

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

  return {
    totalAmount,
    totalRefundedAmount,
    netAmount: totalAmount - totalRefundedAmount,
    count: payments.length,
  };
}

export async function GET() {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const paymentsResult = await supabaseAdmin
      .from('payments')
      .select(
        'id, target_id, order_no, amount, refunded_amount, currency, status, payment_method, approved_at, created_at, refundable_until, failure_message',
      )
      .eq('buyer_user_id', session.authUserId)
      .eq('payment_type', PAYMENT_TYPE.DONATION)
      .eq('target_type', PAYMENT_TARGET_TYPE.DONATION)
      .order('created_at', { ascending: false });

    if (paymentsResult.error) {
      console.error(paymentsResult.error);

      return Response.json({ error: '후원 구입내역을 불러오지 못했습니다.' }, { status: 500 });
    }

    const payments = (paymentsResult.data ?? []) as PaymentRow[];
    const siteIds = Array.from(
      new Set(payments.map((payment) => payment.target_id).filter((targetId): targetId is string => Boolean(targetId))),
    );

    const sitesResult = siteIds.length
      ? await supabaseAdmin.from('rhizomes').select('id, site_key, site_label, site_type').in('id', siteIds)
      : { data: [], error: null };

    if (sitesResult.error) {
      console.error(sitesResult.error);

      return Response.json({ error: '후원 대상 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const sites = (sitesResult.data ?? []) as SiteRow[];
    const siteById = new Map(sites.map((site) => [site.id, site]));

    return Response.json({
      summary: getSummary(payments),
      payments: payments.map((payment) => {
        const site = payment.target_id ? siteById.get(payment.target_id) : null;

        return {
          id: payment.id,
          siteId: site?.id ?? null,
          siteName: site?.site_key ?? null,
          siteLabel: site?.site_label ?? null,
          siteType: site?.site_type ?? null,
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
        };
      }),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '후원 구입내역을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '후원 구입내역을 불러오지 못했습니다.' }, { status: 500 });
  }
}
