import crypto from 'crypto';

const PAYMENT_ORDER_NO_PREFIX = {
  PLAN: 'VH-PLAN',
  SITE_DONATION: 'VH-DNT-SITE',
  BLOG_DONATION: 'VH-DNT-BLOG',
  BOARD_DONATION: 'VH-DNT-BOARD',
  POST_DONATION: 'VH-DNT-POST',
  PURCHASE_POST: 'VH-BUY-POST',
  MEMBERSHIP_BLOG: 'VH-MBS',
  SUBSCRIPTION_BOARD: 'VH-SUBS-BOARD',
  SUBSCRIPTION_SERIES: 'VH-SUBS-SERIES',
} as const;

type PaymentOrderNoType = keyof typeof PAYMENT_ORDER_NO_PREFIX;

export function createPaymentOrderNo(type: PaymentOrderNoType) {
  const randomText = crypto.randomBytes(8).toString('hex');
  const timestamp = Date.now();

  return `${PAYMENT_ORDER_NO_PREFIX[type]}-${timestamp}-${randomText}`;
}
