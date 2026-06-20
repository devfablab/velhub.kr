const DAY_MS = 24 * 60 * 60 * 1000;
const BILLING_CYCLE_DAYS = 30;

export type RefundCalculationResult = {
  isRefundable: boolean;
  isFullRefund: boolean;
  refundAmount: number;
  retainedAmount: number;
  usedDays: number;
  refundWindowDays: number;
};

export function getPaymentPolicyDays() {
  return process.env.NEXT_PUBLIC_APP_ENV === 'test' ? 1 : 7;
}

export function getPaymentPolicyMs() {
  return getPaymentPolicyDays() * DAY_MS;
}

export function getPastDueGraceDays() {
  return process.env.NEXT_PUBLIC_APP_ENV === 'test' ? 1 : 7;
}

function getElapsedTime(startedAt: string | Date, now = new Date()) {
  const startedDate = startedAt instanceof Date ? startedAt : new Date(startedAt);
  const elapsedMs = now.getTime() - startedDate.getTime();

  return Math.max(0, elapsedMs);
}

export function calculateSubscriptionRefundAmount({
  amount,
  paidAt,
  now = new Date(),
}: {
  amount: number;
  paidAt: string | Date;
  now?: Date;
}): RefundCalculationResult {
  const refundWindowDays = getPaymentPolicyDays();
  const elapsedMs = getElapsedTime(paidAt, now);

  if (elapsedMs <= DAY_MS) {
    return {
      isRefundable: true,
      isFullRefund: true,
      refundAmount: amount,
      retainedAmount: 0,
      usedDays: 0,
      refundWindowDays,
    };
  }

  if (elapsedMs > refundWindowDays * DAY_MS) {
    return {
      isRefundable: false,
      isFullRefund: false,
      refundAmount: 0,
      retainedAmount: amount,
      usedDays: BILLING_CYCLE_DAYS,
      refundWindowDays,
    };
  }

  const usedDays = Math.min(BILLING_CYCLE_DAYS, Math.max(1, Math.ceil((elapsedMs - DAY_MS) / DAY_MS)));
  const retainedAmount = Math.ceil((amount * usedDays) / BILLING_CYCLE_DAYS);
  const refundAmount = Math.max(0, amount - retainedAmount);

  return {
    isRefundable: refundAmount > 0,
    isFullRefund: false,
    refundAmount,
    retainedAmount,
    usedDays,
    refundWindowDays,
  };
}

export function calculateDonationRefundAmount({
  amount,
  paidAt,
  now = new Date(),
  isManualException = false,
}: {
  amount: number;
  paidAt: string | Date;
  now?: Date;
  isManualException?: boolean;
}): RefundCalculationResult {
  const refundWindowDays = getPaymentPolicyDays();
  const elapsedMs = getElapsedTime(paidAt, now);

  if (isManualException || elapsedMs <= refundWindowDays * DAY_MS) {
    return {
      isRefundable: true,
      isFullRefund: true,
      refundAmount: amount,
      retainedAmount: 0,
      usedDays: 0,
      refundWindowDays,
    };
  }

  return {
    isRefundable: false,
    isFullRefund: false,
    refundAmount: 0,
    retainedAmount: amount,
    usedDays: 0,
    refundWindowDays,
  };
}
