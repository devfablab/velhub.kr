export const PAYMENT_PROVIDER = {
  TOSS: 'toss',
} as const;

export const PAYMENT_METHOD = {
  CARD: 'card',
} as const;

export const PAYMENT_STATUS = {
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;

export const PAYMENT_TYPE = {
  PLAN_BILLING: 'plan_billing',
  BLOG_MEMBERSHIP: 'blog_membership',
  SERIES_SUBSCRIPTION: 'series_subscription',
  BOARD_SUBSCRIPTION: 'board_subscription',
  DONATION: 'donation',
} as const;

export const PAYMENT_TARGET_TYPE = {
  PLAN: 'plan',
  BLOG: 'blog',
  SERIES: 'series',
  BOARD: 'board',
  DONATION: 'donation',
} as const;

export const REFUND_POLICY = {
  SEVEN_DAYS: 'seven_days',
  DONATION_RESTRICTED: 'donation_restricted',
} as const;

export const SUBSCRIPTION_TYPE = {
  PLAN_BILLING: 'plan_billing',
  BLOG_MEMBERSHIP: 'blog_membership',
  SERIES_SUBSCRIPTION: 'series_subscription',
  BOARD_SUBSCRIPTION: 'board_subscription',
} as const;

export const SUBSCRIPTION_STATUS = {
  TRIALING: 'trialing',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  EXPIRED: 'expired',
} as const;

export type PaymentProvider = (typeof PAYMENT_PROVIDER)[keyof typeof PAYMENT_PROVIDER];
export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];
export type PaymentType = (typeof PAYMENT_TYPE)[keyof typeof PAYMENT_TYPE];
export type PaymentTargetType = (typeof PAYMENT_TARGET_TYPE)[keyof typeof PAYMENT_TARGET_TYPE];
export type RefundPolicy = (typeof REFUND_POLICY)[keyof typeof REFUND_POLICY];
export type SubscriptionType = (typeof SUBSCRIPTION_TYPE)[keyof typeof SUBSCRIPTION_TYPE];
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];
