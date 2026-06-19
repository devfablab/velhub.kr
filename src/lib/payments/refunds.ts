const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const BILLING_CYCLE_DAYS = 30;
const PAYMENT_POLICY_DAYS = 7;

export type RefundCalculationResult = {
  isRefundable: boolean;
  isFullRefund: boolean;
  refundAmount: number;
  retainedAmount: number;
  usedDays: number;
  refundWindowDays: number;
  refundWindowMs: number;
};

function isTestMode() {
  return process.env.NEXT_PUBLIC_APP_ENV === 'test';
}

export function getPaymentPolicyDays() {
  return PAYMENT_POLICY_DAYS;
}

export function getPaymentPolicyMs() {
  if (isTestMode()) {
    return HOUR_MS;
  }

  return PAYMENT_POLICY_DAYS * DAY_MS;
}

export function getPastDueGraceDays() {
  return isTestMode() ? 1 : 7;
}

function getElapsedTime(startedAt: string | Date, now = new Date()) {
  const startedDate = startedAt instanceof Date ? startedAt : new Date(startedAt);
  const elapsedMs = now.getTime() - startedDate.getTime();

  return Math.max(0, elapsedMs);
}

function createFullRefundResult(amount: number, refundWindowMs: number): RefundCalculationResult {
  return {
    isRefundable: true,
    isFullRefund: true,
    refundAmount: amount,
    retainedAmount: 0,
    usedDays: 0,
    refundWindowDays: PAYMENT_POLICY_DAYS,
    refundWindowMs,
  };
}

function createNonRefundableResult(amount: number, refundWindowMs: number): RefundCalculationResult {
  return {
    isRefundable: false,
    isFullRefund: false,
    refundAmount: 0,
    retainedAmount: amount,
    usedDays: BILLING_CYCLE_DAYS,
    refundWindowDays: PAYMENT_POLICY_DAYS,
    refundWindowMs,
  };
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
  const refundWindowMs = getPaymentPolicyMs();
  const elapsedMs = getElapsedTime(paidAt, now);

  if (isTestMode()) {
    if (elapsedMs <= refundWindowMs) {
      return createFullRefundResult(amount, refundWindowMs);
    }

    return createNonRefundableResult(amount, refundWindowMs);
  }

  if (elapsedMs <= DAY_MS) {
    return createFullRefundResult(amount, refundWindowMs);
  }

  if (elapsedMs > refundWindowMs) {
    return createNonRefundableResult(amount, refundWindowMs);
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
    refundWindowDays: PAYMENT_POLICY_DAYS,
    refundWindowMs,
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
  const refundWindowMs = getPaymentPolicyMs();
  const elapsedMs = getElapsedTime(paidAt, now);

  if (isManualException || elapsedMs <= refundWindowMs) {
    return createFullRefundResult(amount, refundWindowMs);
  }

  return createNonRefundableResult(amount, refundWindowMs);
}
