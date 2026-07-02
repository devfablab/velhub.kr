import type { RevenueContext } from '@/lib/revenue/context';
import { toNumber } from '@/lib/revenue/amounts';

type UnknownRecord = Record<string, unknown>;

type PaymentSplitRow = UnknownRecord & {
  payment_id: string | null;
  amount: number | string | null;
};

export type RevenueSummaryResponse = {
  totalPaymentAmount: number;
  totalPaymentCount: number;
  todayPaymentAmount: number;
  todayPaymentCount: number;
  totalRefundAmount: number;
  totalRefundCount: number;
  todayRefundAmount: number;
  todayRefundCount: number;
};

function getStringValue(row: UnknownRecord | null | undefined, key: string) {
  const value = row?.[key];

  if (typeof value !== 'string') {
    return null;
  }

  return value;
}

function getTodayKstRange() {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = kstNow.getUTCFullYear();
  const month = kstNow.getUTCMonth();
  const date = kstNow.getUTCDate();

  return {
    startDate: new Date(Date.UTC(year, month, date, -9, 0, 0, 0)).toISOString(),
    endDate: new Date(Date.UTC(year, month, date + 1, -9, 0, 0, 0)).toISOString(),
  };
}

function uniqueIds(values: (string | null)[]) {
  return [...new Set(values.filter((value): value is string => !!value))];
}

function getPaymentAmount(split: PaymentSplitRow, payment: UnknownRecord | null) {
  return toNumber(payment?.amount ?? split.amount);
}

function getRefundAmount(payment: UnknownRecord | null) {
  return toNumber(payment?.refunded_amount);
}

function getPaidAt(payment: UnknownRecord | null) {
  return getStringValue(payment, 'paid_at') ?? getStringValue(payment, 'approved_at') ?? getStringValue(payment, 'created_at');
}

function getRefundedAt(payment: UnknownRecord | null) {
  return getStringValue(payment, 'refunded_at') ?? getStringValue(payment, 'cancelled_at') ?? getStringValue(payment, 'canceled_at');
}

export async function getRevenueSummary(context: RevenueContext): Promise<RevenueSummaryResponse> {
  const splitResult = await context.supabase
    .from('payment_splits')
    .select('*')
    .eq('site_id', context.siteId)
    .eq('receiver_user_id', context.userId);

  if (splitResult.error) {
    throw splitResult.error;
  }

  const splitRows = (splitResult.data ?? []) as PaymentSplitRow[];
  const paymentIds = uniqueIds(splitRows.map((row) => row.payment_id));
  const paymentResult =
    paymentIds.length > 0
      ? await context.supabase.from('payments').select('*').in('id', paymentIds)
      : { data: [], error: null };

  if (paymentResult.error) {
    throw paymentResult.error;
  }

  const paymentRows = (paymentResult.data ?? []) as UnknownRecord[];
  const paymentMap = new Map(paymentRows.map((payment) => [String(payment.id), payment]));
  const todayRange = getTodayKstRange();

  return splitRows.reduce<RevenueSummaryResponse>(
    (summary, split) => {
      const payment = split.payment_id ? paymentMap.get(split.payment_id) ?? null : null;
      const paymentAmount = getPaymentAmount(split, payment);
      const refundAmount = getRefundAmount(payment);
      const paidAt = getPaidAt(payment);
      const refundedAt = getRefundedAt(payment);
      const isTodayPayment = !!paidAt && paidAt >= todayRange.startDate && paidAt < todayRange.endDate;
      const isTodayRefund = !!refundedAt && refundedAt >= todayRange.startDate && refundedAt < todayRange.endDate;

      return {
        totalPaymentAmount: summary.totalPaymentAmount + paymentAmount,
        totalPaymentCount: summary.totalPaymentCount + 1,
        todayPaymentAmount: summary.todayPaymentAmount + (isTodayPayment ? paymentAmount : 0),
        todayPaymentCount: summary.todayPaymentCount + (isTodayPayment ? 1 : 0),
        totalRefundAmount: summary.totalRefundAmount + refundAmount,
        totalRefundCount: summary.totalRefundCount + (refundAmount > 0 ? 1 : 0),
        todayRefundAmount: summary.todayRefundAmount + (isTodayRefund ? refundAmount : 0),
        todayRefundCount: summary.todayRefundCount + (isTodayRefund ? 1 : 0),
      };
    },
    {
      totalPaymentAmount: 0,
      totalPaymentCount: 0,
      todayPaymentAmount: 0,
      todayPaymentCount: 0,
      totalRefundAmount: 0,
      totalRefundCount: 0,
      todayRefundAmount: 0,
      todayRefundCount: 0,
    },
  );
}
