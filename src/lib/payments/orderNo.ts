import crypto from 'crypto';

const PAYMENT_ORDER_NO_PREFIX = {
  MEMBERSHIP: 'VH-MEMBER',
  DONATION_SITE: 'VH-DNT-SITE',
  DONATION_SERIES: 'VH-DNT-SERIES',
  DONATION_POST: 'VH-DNT-POST',
  PURCHASE_POST: 'VH-BUY-POST',
  SUBSCRIPTION_SITE: 'VH-SUBS-SITE',
  SUBSCRIPTION_SERIES: 'VH-SUBS-SERIES',
} as const;

const LEGACY_PAYMENT_ORDER_NO_PREFIX = {
  SUBSCRIPTION_SITE: ['VH-MBS'],
} satisfies Partial<Record<keyof typeof PAYMENT_ORDER_NO_PREFIX, readonly string[]>>;

type PaymentOrderNoType = keyof typeof PAYMENT_ORDER_NO_PREFIX;

export function createPaymentOrderNo(type: PaymentOrderNoType) {
  const randomText = crypto.randomBytes(3).toString('hex');
  const timestamp = Date.now();

  return `${PAYMENT_ORDER_NO_PREFIX[type]}-${timestamp}-${randomText}`;
}

export function isPaymentOrderNo(orderNo: string, type: PaymentOrderNoType) {
  const prefixes = [
    PAYMENT_ORDER_NO_PREFIX[type],
    ...(type in LEGACY_PAYMENT_ORDER_NO_PREFIX
      ? LEGACY_PAYMENT_ORDER_NO_PREFIX[type as keyof typeof LEGACY_PAYMENT_ORDER_NO_PREFIX]
      : []),
  ];

  return prefixes.some((prefix) => orderNo.startsWith(`${prefix}-`));
}
