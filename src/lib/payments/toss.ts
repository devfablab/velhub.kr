type TossBillingKeyRequest = {
  authKey: string;
  customerKey: string;
};

export type TossBillingKeyResponse = {
  mId: string;
  customerKey: string;
  authenticatedAt: string;
  method: string;
  billingKey: string;
  card: {
    issuerCode: string;
    acquirerCode: string;
    number: string;
    cardType: string;
    ownerType: string;
  };
};

type TossErrorResponse = {
  code?: string;
  message?: string;
};

export type TossApiError = {
  code: string;
  message: string;
  rawData: TossErrorResponse | null;
};

function getTossSecretKey() {
  const tossSecretKey = process.env.NEXT_PUBLIC_TOSS_SECRET_KEY;

  if (!tossSecretKey) {
    throw new Error('NEXT_PUBLIC_TOSS_SECRET_KEY가 설정되지 않았습니다.');
  }

  return tossSecretKey;
}

export function getTossClientKey() {
  const tossClientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;

  if (!tossClientKey) {
    throw new Error('NEXT_PUBLIC_TOSS_CLIENT_KEY가 설정되지 않았습니다.');
  }

  return tossClientKey;
}

function getTossAuthorizationHeader() {
  const encodedSecretKey = Buffer.from(`${getTossSecretKey()}:`, 'utf8').toString('base64');

  return `Basic ${encodedSecretKey}`;
}

function isTossErrorResponse(value: unknown): value is TossErrorResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return 'code' in value || 'message' in value;
}

async function parseTossResponse(response: Response) {
  const responseText = await response.text();

  if (!responseText) {
    return null;
  }

  return JSON.parse(responseText) as unknown;
}

function createTossApiError(responseData: unknown, fallbackMessage: string): TossApiError {
  if (isTossErrorResponse(responseData)) {
    return {
      code: responseData.code ?? 'TOSS_API_ERROR',
      message: responseData.message ?? fallbackMessage,
      rawData: responseData,
    };
  }

  return {
    code: 'TOSS_API_ERROR',
    message: fallbackMessage,
    rawData: null,
  };
}

export async function issueTossBillingKey(params: TossBillingKeyRequest) {
  const response = await fetch('https://api.tosspayments.com/v1/billing/authorizations/issue', {
    method: 'POST',
    headers: {
      Authorization: getTossAuthorizationHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      authKey: params.authKey,
      customerKey: params.customerKey,
    }),
    cache: 'no-store',
  });

  const responseData = await parseTossResponse(response);

  if (!response.ok) {
    throw createTossApiError(responseData, '토스 빌링키 발급에 실패했습니다.');
  }

  return responseData as TossBillingKeyResponse;
}

type TossBillingPaymentApiError = {
  code?: string;
  message?: string;
  [key: string]: unknown;
};

export type TossBillingPaymentResponse = {
  paymentKey: string;
  orderId: string;
  orderName: string;
  status: string;
  method: string | null;
  approvedAt: string | null;
  totalAmount: number;
  currency: string;
  [key: string]: unknown;
};

export class TossBillingPaymentError extends Error {
  code: string | null;
  rawData: TossBillingPaymentApiError;

  constructor(errorData: TossBillingPaymentApiError) {
    super(errorData.message || '자동결제에 실패했습니다.');
    this.name = 'TossBillingPaymentError';
    this.code = errorData.code ?? null;
    this.rawData = errorData;
  }
}

export type TossCancelPaymentParams = {
  paymentKey: string;
  cancelReason: string;
  cancelAmount?: number;
};

export type TossCancelPaymentResult = {
  mId: string;
  version: string;
  paymentKey: string;
  orderId: string;
  orderName: string;
  currency: string;
  method: string;
  totalAmount: number;
  balanceAmount: number;
  status: string;
  requestedAt: string;
  approvedAt: string | null;
  useEscrow: boolean;
  lastTransactionKey: string | null;
  suppliedAmount: number;
  vat: number;
  cultureExpense: boolean;
  taxFreeAmount: number;
  taxExemptionAmount: number;
  cancels:
    | {
        cancelAmount: number;
        cancelReason: string;
        taxFreeAmount: number;
        taxExemptionAmount: number;
        refundableAmount: number;
        easyPayDiscountAmount: number;
        canceledAt: string;
        transactionKey: string;
        receiptKey: string | null;
        cancelStatus: string;
        cancelRequestId: string | null;
      }[]
    | null;
};

export async function cancelTossPayment({ paymentKey, cancelReason, cancelAmount }: TossCancelPaymentParams) {
  const secretKey = getTossSecretKey();
  const encodedSecretKey = Buffer.from(`${secretKey}:`).toString('base64');

  const body =
    typeof cancelAmount === 'number'
      ? {
          cancelReason,
          cancelAmount,
        }
      : {
          cancelReason,
        };

  const response = await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${encodedSecretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const result = (await response.json()) as TossCancelPaymentResult & {
    code?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(result.message || '결제 취소에 실패했습니다.');
  }

  return result;
}

export async function requestTossBillingPayment({
  billingKey,
  customerKey,
  amount,
  orderId,
  orderName,
}: {
  billingKey: string;
  customerKey: string;
  amount: number;
  orderId: string;
  orderName: string;
}) {
  const encodedSecretKey = Buffer.from(`${getTossSecretKey()}:`).toString('base64');

  const response = await fetch(`https://api.tosspayments.com/v1/billing/${billingKey}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${encodedSecretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customerKey,
      amount,
      orderId,
      orderName,
    }),
  });

  const result = (await response.json()) as TossBillingPaymentResponse | TossBillingPaymentApiError;

  if (!response.ok) {
    throw new TossBillingPaymentError(result as TossBillingPaymentApiError);
  }

  return result as TossBillingPaymentResponse;
}

type TossPaymentConfirmApiError = {
  code?: string;
  message?: string;
  [key: string]: unknown;
};

export type TossPaymentConfirmResponse = {
  paymentKey: string;
  orderId: string;
  orderName: string;
  status: string;
  method: string | null;
  approvedAt: string | null;
  totalAmount: number;
  currency: string;
  [key: string]: unknown;
};

export class TossPaymentConfirmError extends Error {
  code: string | null;
  rawData: TossPaymentConfirmApiError;

  constructor(errorData: TossPaymentConfirmApiError) {
    super(errorData.message || '결제 승인에 실패했습니다.');

    this.name = 'TossPaymentConfirmError';
    this.code = errorData.code ?? null;
    this.rawData = errorData;
  }
}

export async function confirmTossPayment({
  paymentKey,
  orderId,
  amount,
}: {
  paymentKey: string;
  orderId: string;
  amount: number;
}) {
  const encodedSecretKey = Buffer.from(`${getTossSecretKey()}:`).toString('base64');

  const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${encodedSecretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      paymentKey,
      orderId,
      amount,
    }),
  });

  const result = (await response.json()) as TossPaymentConfirmResponse | TossPaymentConfirmApiError;

  if (!response.ok) {
    throw new TossPaymentConfirmError(result as TossPaymentConfirmApiError);
  }

  return result as TossPaymentConfirmResponse;
}
