const MIN_BILLING_ANCHOR_DAY = 1;
const MAX_BILLING_ANCHOR_DAY = 31;

function clampBillingAnchorDay(day: number) {
  if (!Number.isInteger(day)) {
    return MIN_BILLING_ANCHOR_DAY;
  }

  return Math.min(MAX_BILLING_ANCHOR_DAY, Math.max(MIN_BILLING_ANCHOR_DAY, day));
}

function getLastDayOfUtcMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function getBillingAnchorDay(date = new Date()) {
  return date.getUTCDate();
}

export function getNextMonthlyBillingDate({
  fromDate,
  billingAnchorDay,
}: {
  fromDate: Date;
  billingAnchorDay: number;
}) {
  const normalizedAnchorDay = clampBillingAnchorDay(billingAnchorDay);
  const currentYear = fromDate.getUTCFullYear();
  const currentMonthIndex = fromDate.getUTCMonth();
  const targetMonthIndexFromZero = currentMonthIndex + 1;
  const targetYear = currentYear + Math.floor(targetMonthIndexFromZero / 12);
  const targetMonthIndex = targetMonthIndexFromZero % 12;
  const lastDayOfTargetMonth = getLastDayOfUtcMonth(targetYear, targetMonthIndex);
  const targetDay = Math.min(normalizedAnchorDay, lastDayOfTargetMonth);

  return new Date(
    Date.UTC(
      targetYear,
      targetMonthIndex,
      targetDay,
      fromDate.getUTCHours(),
      fromDate.getUTCMinutes(),
      fromDate.getUTCSeconds(),
      fromDate.getUTCMilliseconds(),
    ),
  );
}

export function createMonthlyBillingPeriod({
  startedAt = new Date(),
  billingAnchorDay = getBillingAnchorDay(startedAt),
}: {
  startedAt?: Date;
  billingAnchorDay?: number;
}) {
  const normalizedAnchorDay = clampBillingAnchorDay(billingAnchorDay);
  const periodEnd = new Date(startedAt);

  if (process.env.NEXT_PUBLIC_APP_ENV === 'test') {
    periodEnd.setHours(periodEnd.getHours() + 1);
  } else {
    periodEnd.setDate(periodEnd.getDate() + 7);
  }

  return {
    billingAnchorDay: normalizedAnchorDay,
    currentPeriodStart: startedAt.toISOString(),
    currentPeriodEnd: periodEnd.toISOString(),
    nextBillingAt: periodEnd.toISOString(),
  };
}

export function createNextMonthlyBillingPeriod({
  currentPeriodEnd,
  billingAnchorDay,
}: {
  currentPeriodEnd: string | Date;
  billingAnchorDay: number;
}) {
  const periodStart = currentPeriodEnd instanceof Date ? currentPeriodEnd : new Date(currentPeriodEnd);
  const periodEnd = getNextMonthlyBillingDate({
    fromDate: periodStart,
    billingAnchorDay,
  });

  return {
    currentPeriodStart: periodStart.toISOString(),
    currentPeriodEnd: periodEnd.toISOString(),
    nextBillingAt: periodEnd.toISOString(),
  };
}
