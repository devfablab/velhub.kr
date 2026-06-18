import crypto from 'crypto';

const PAYMENT_ORDER_NO_PREFIX = {
  PLAN: 'VH-PLAN',
  SITE_DONATION: 'VH-DNT-SITE',
  POST_DONATION: 'VH-DNT-POST',
  BLOG_MEMBERSHIP: 'VH-MBS',
  BOARD_SUBSCRIPTION: 'VH-SUBS-BOARD',
  SERIES_SUBSCRIPTION: 'VH-SUBS-SERIES',
} as const;

type PaymentOrderNoType = keyof typeof PAYMENT_ORDER_NO_PREFIX;

export function createPaymentOrderNo(type: PaymentOrderNoType) {
  const randomText = crypto.randomBytes(8).toString('hex');
  const timestamp = Date.now();

  return `${PAYMENT_ORDER_NO_PREFIX[type]}-${timestamp}-${randomText}`;
}
