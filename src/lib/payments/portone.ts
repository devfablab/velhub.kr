const PORTONE_PROVIDER = {
  KPN: 'kpn',
  INICIS: 'inicis',
} as const;

type PortOneProvider = (typeof PORTONE_PROVIDER)[keyof typeof PORTONE_PROVIDER];

const CURRENT_PORTONE_PROVIDER: PortOneProvider = PORTONE_PROVIDER.KPN;

type PortOneErrorResponse = {
  type?: string;
  code?: string;
  message?: string;
  [key: string]: unknown;
};

export type PortOneApiErrorData = {
  code: string;
  message: string;
  rawData: PortOneErrorResponse | null;
};

export class PortOneApiError extends Error {
  code: string;
  rawData: PortOneErrorResponse | null;

  constructor(errorData: PortOneApiErrorData) {
    super(errorData.message);
    this.name = 'PortOneApiError';
    this.code = errorData.code;
    this.rawData = errorData.rawData;
  }
}

type PortOneBillingKeyPaymentParams = {
  paymentId: string;
  billingKey: string;
  channelKey?: string;
  orderName: string;
  customerId: string;
  amount: number;
};

export type PortOnePayment = {
  status: string;
  id: string;
  pgTxId?: string;
  transactionId?: string;
  paymentId?: string;
  orderName?: string;
  paidAt?: string;
  approvedAt?: string;
  amount?: {
    total?: number;
    paid?: number;
    cancelled?: number;
    balance?: number;
    currency?: string;
    [key: string]: unknown;
  };
  method?: {
    type?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type PortOnePaymentResponse = {
  payment?: PortOnePayment;
  [key: string]: unknown;
};

type PortOneBillingKeyCard = {
  issuer?: unknown;
  type?: unknown;
  number?: unknown;
  [key: string]: unknown;
};

type PortOneBillingKeyPaymentMethod = {
  type?: unknown;
  card?: PortOneBillingKeyCard;
  [key: string]: unknown;
};

export type PortOneBillingKeyInfo = {
  status: string;
  billingKey: string;
  merchantId?: string;
  storeId?: string;
  customer?: {
    id?: string;
    name?: string;
    email?: string;
    phoneNumber?: string;
    [key: string]: unknown;
  };
  issueId?: string;
  issueName?: string;
  requestedAt?: string;
  issuedAt?: string;
  methods?: PortOneBillingKeyPaymentMethod[];
  channels?: unknown[];
  pgBillingKeyIssueResponses?: unknown[];
  [key: string]: unknown;
};

export type PortOneBillingCardInfo = {
  cardCompany: string;
  cardNumberMasked: string;
  cardType: string;
  ownerType: 'PERSONAL';
};

function getRequiredEnv(key: string) {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key}가 설정되지 않았습니다.`);
  }

  return value;
}

function getPortOneApiSecret() {
  return getRequiredEnv('PORTONE_API_SECRET');
}

export function getPortOneStoreId() {
  return getRequiredEnv('NEXT_PUBLIC_PORTONE_STORE_ID');
}

export function getCurrentPortOneProvider() {
  return CURRENT_PORTONE_PROVIDER;
}

export function createPortOnePaymentKey(orderNo: string) {
  return orderNo.replace(/[^A-Za-z0-9]/g, '');
}

export function getPortOneKpnGeneralChannelKey() {
  if (CURRENT_PORTONE_PROVIDER === PORTONE_PROVIDER.INICIS) {
    return getRequiredEnv('NEXT_PUBLIC_PORTONE_INICIS_GENERAL_CHANNEL_KEY');
  }

  return getRequiredEnv('NEXT_PUBLIC_PORTONE_KPN_GENERAL_CHANNEL_KEY');
}

export function getPortOneKpnSubscriptionChannelKey() {
  if (CURRENT_PORTONE_PROVIDER === PORTONE_PROVIDER.INICIS) {
    return getRequiredEnv('NEXT_PUBLIC_PORTONE_INICIS_SUBSCRIPTION_CHANNEL_KEY');
  }

  return getRequiredEnv('NEXT_PUBLIC_PORTONE_KPN_SUBSCRIPTION_CHANNEL_KEY');
}

function getPortOneAuthorizationHeader() {
  return `PortOne ${getPortOneApiSecret()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isPortOneErrorResponse(value: unknown): value is PortOneErrorResponse {
  if (!isRecord(value)) {
    return false;
  }

  return 'type' in value || 'code' in value || 'message' in value;
}

async function parsePortOneResponse(response: Response) {
  const responseText = await response.text();

  if (!responseText) {
    return null;
  }

  return JSON.parse(responseText) as unknown;
}

function createPortOneApiError(responseData: unknown, fallbackMessage: string) {
  if (isPortOneErrorResponse(responseData)) {
    return new PortOneApiError({
      code: responseData.code ?? responseData.type ?? 'PORTONE_API_ERROR',
      message: responseData.message ?? fallbackMessage,
      rawData: responseData,
    });
  }

  return new PortOneApiError({
    code: 'PORTONE_API_ERROR',
    message: fallbackMessage,
    rawData: null,
  });
}

async function requestPortOneApi(path: string, init: RequestInit, fallbackMessage: string) {
  const response = await fetch(`https://api.portone.io${path}`, {
    ...init,
    headers: {
      Authorization: getPortOneAuthorizationHeader(),
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });

  const responseData = await parsePortOneResponse(response);

  if (!response.ok) {
    throw createPortOneApiError(responseData, fallbackMessage);
  }

  return responseData;
}

export function getPortOnePaymentId(value: string) {
  return encodeURIComponent(value);
}

export async function getPortOnePayment(paymentId: string) {
  const responseData = await requestPortOneApi(
    `/payments/${getPortOnePaymentId(paymentId)}`,
    {
      method: 'GET',
    },
    '결제 정보를 조회하지 못했습니다.',
  );

  return responseData as PortOnePaymentResponse;
}

function isPortOneBillingKeyInfo(value: unknown): value is PortOneBillingKeyInfo {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.status === 'string' && typeof value.billingKey === 'string';
}

function getBillingKeyInfoFromResponse(responseData: unknown): PortOneBillingKeyInfo {
  if (isPortOneBillingKeyInfo(responseData)) {
    return responseData;
  }

  if (isRecord(responseData) && isPortOneBillingKeyInfo(responseData.billingKeyInfo)) {
    return responseData.billingKeyInfo;
  }

  throw new Error('빌링키 정보를 확인하지 못했습니다.');
}

export async function getPortOneBillingKeyInfo(billingKey: string): Promise<PortOneBillingKeyInfo> {
  const responseData = await requestPortOneApi(
    `/billing-keys/${encodeURIComponent(billingKey)}`,
    {
      method: 'GET',
    },
    '빌링키 정보를 조회하지 못했습니다.',
  );

  return getBillingKeyInfoFromResponse(responseData);
}

function getStringValue(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return '';
}

function getPortOneBillingMethodCard(method: unknown): PortOneBillingKeyCard | null {
  if (!isRecord(method)) {
    return null;
  }

  if (method.type !== 'BillingKeyPaymentMethodCard' && method.type !== 'CARD') {
    return null;
  }

  if (!isRecord(method.card)) {
    return null;
  }

  return method.card;
}

function getPortOneBillingMethodCandidates(billingKeyInfo: PortOneBillingKeyInfo) {
  const methods: unknown[] = [...(billingKeyInfo.methods ?? [])];

  billingKeyInfo.pgBillingKeyIssueResponses?.forEach((response) => {
    if (isRecord(response)) {
      methods.push(response.method);
    }
  });

  return methods;
}

function parsePortOneBillingCardInfo(card: PortOneBillingKeyCard): PortOneBillingCardInfo | null {
  const cardCompany = getStringValue(card.issuer);
  const cardNumberMasked = getStringValue(card.number);
  const cardType = getStringValue(card.type);

  if (!cardCompany || !cardNumberMasked || !cardType) {
    return null;
  }

  return {
    cardCompany,
    cardNumberMasked,
    cardType,
    ownerType: 'PERSONAL',
  };
}

export function getPortOneBillingCardInfo(billingKeyInfo: PortOneBillingKeyInfo): PortOneBillingCardInfo {
  const cardInfo = getPortOneBillingMethodCandidates(billingKeyInfo)
    .map((method) => getPortOneBillingMethodCard(method))
    .filter((card): card is PortOneBillingKeyCard => Boolean(card))
    .map((card) => parsePortOneBillingCardInfo(card))
    .find((billingCardInfo): billingCardInfo is PortOneBillingCardInfo => Boolean(billingCardInfo));

  if (!cardInfo) {
    console.error(
      'PortOne billing card parse failed:',
      JSON.stringify(
        {
          billingKeyInfo,
          methods: getPortOneBillingMethodCandidates(billingKeyInfo),
        },
        null,
        2,
      ),
    );

    throw new Error('빌링키 카드 정보를 확인하지 못했습니다.');
  }

  return cardInfo;
}

export async function requestPortOneBillingPayment({
  paymentId,
  billingKey,
  channelKey = getPortOneKpnSubscriptionChannelKey(),
  orderName,
  customerId,
  amount,
}: PortOneBillingKeyPaymentParams) {
  const responseData = await requestPortOneApi(
    `/payments/${getPortOnePaymentId(paymentId)}/billing-key`,
    {
      method: 'POST',
      body: JSON.stringify({
        storeId: getPortOneStoreId(),
        billingKey,
        channelKey,
        orderName,
        customer: {
          id: customerId,
        },
        amount: {
          total: amount,
        },
        currency: 'KRW',
      }),
    },
    '자동결제에 실패했습니다.',
  );

  console.error('PortOne billing payment response:', JSON.stringify(responseData, null, 2));
  return responseData as PortOnePaymentResponse;
}

export async function cancelPortOnePayment({
  paymentId,
  cancelReason,
  cancelAmount,
}: {
  paymentId: string;
  cancelReason: string;
  cancelAmount?: number;
}) {
  const body =
    typeof cancelAmount === 'number'
      ? {
          storeId: getPortOneStoreId(),
          amount: cancelAmount,
          reason: cancelReason,
        }
      : {
          storeId: getPortOneStoreId(),
          reason: cancelReason,
        };

  const responseData = await requestPortOneApi(
    `/payments/${getPortOnePaymentId(paymentId)}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    '결제 취소에 실패했습니다.',
  );

  return responseData;
}

export function getPortOnePaymentTransactionNo(payment: PortOnePayment) {
  if (typeof payment.transactionId === 'string' && payment.transactionId.trim()) {
    return payment.transactionId.trim();
  }

  if (typeof payment.pgTxId === 'string' && payment.pgTxId.trim()) {
    return payment.pgTxId.trim();
  }

  return null;
}

export function getPortOnePaymentFromResponse(paymentResponse: PortOnePaymentResponse) {
  if (paymentResponse.payment) {
    const payment = paymentResponse.payment;

    if (!payment.status && payment.paidAt) {
      return {
        ...payment,
        status: 'PAID',
      };
    }

    return payment;
  }

  console.error('PortOne payment field missing:', JSON.stringify(paymentResponse, null, 2));

  throw new Error('포트원 결제 응답에서 payment 정보를 확인하지 못했습니다.');
}

export function assertPortOnePaidPayment(payment: PortOnePayment) {
  if (String(payment.status ?? '').toUpperCase() !== 'PAID') {
    throw new Error('결제가 완료되지 않았습니다.');
  }
}

export function getPortOnePaidAt(payment: PortOnePayment) {
  return payment.paidAt ?? payment.approvedAt ?? new Date().toISOString();
}

export function getPortOnePaidAmount(payment: PortOnePayment) {
  return payment.amount?.paid ?? payment.amount?.total ?? 0;
}

export function getPortOnePaymentMethod(payment: PortOnePayment) {
  const methodType = payment.method?.type;

  if (typeof methodType === 'string') {
    return methodType.toLowerCase();
  }

  return 'card';
}
