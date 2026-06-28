import {
  PortOneIdentityVerificationResponse,
  PortOneIdentityVerificationStartResponse,
  VerifiedIdentity,
} from './types';

type RecordValue = Record<string, unknown>;

function getPortOneStoreId() {
  const storeId = process.env.PORTONE_STORE_ID;

  if (!storeId) {
    throw new Error('PORTONE_STORE_ID가 설정되지 않았습니다.');
  }

  return storeId;
}

function getPortOneIdentityChannelKey() {
  const channelKey = process.env.PORTONE_IDENTITY_CHANNEL_KEY;

  if (!channelKey) {
    throw new Error('PORTONE_IDENTITY_CHANNEL_KEY가 설정되지 않았습니다.');
  }

  return channelKey;
}

function getPortOneApiSecret() {
  const apiSecret = process.env.PORTONE_API_SECRET;

  if (!apiSecret) {
    throw new Error('PORTONE_API_SECRET가 설정되지 않았습니다.');
  }

  return apiSecret;
}

function toRecord(value: unknown): RecordValue | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as RecordValue;
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBirthDate(value: string) {
  return value.replace(/\D/g, '').slice(0, 8);
}

export function createIdentityVerificationId(userId: string) {
  return `identity-${userId}-${crypto.randomUUID()}`;
}

export function createPortOneIdentityRequest(identityVerificationId: string): PortOneIdentityVerificationStartResponse {
  return {
    storeId: getPortOneStoreId(),
    channelKey: getPortOneIdentityChannelKey(),
    identityVerificationId,
  };
}

export async function getPortOneIdentityVerification(identityVerificationId: string) {
  const response = await fetch(
    `https://api.portone.io/identity-verifications/${encodeURIComponent(identityVerificationId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `PortOne ${getPortOneApiSecret()}`,
      },
      cache: 'no-store',
    },
  );

  const data = (await response.json().catch(() => null)) as PortOneIdentityVerificationResponse | null;

  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      data,
    };
  }

  return {
    ok: true as const,
    data,
  };
}

export function extractVerifiedIdentity(
  identityVerificationId: string,
  data: PortOneIdentityVerificationResponse | null,
): VerifiedIdentity | null {
  const root = toRecord(data);

  if (!root) {
    return null;
  }

  const wrappedData = toRecord(root.data);
  const identityVerification = toRecord(root.identityVerification) ?? wrappedData ?? root;
  const status = getString(identityVerification.status);

  if (status !== 'VERIFIED') {
    return null;
  }

  const id = getString(identityVerification.id);

  if (id && id !== identityVerificationId) {
    return null;
  }

  const verifiedCustomer = toRecord(identityVerification.verifiedCustomer);

  if (!verifiedCustomer) {
    return null;
  }

  const name = getString(verifiedCustomer.name);
  const birthDate = normalizeBirthDate(getString(verifiedCustomer.birthDate));
  const gender = getString(verifiedCustomer.gender);

  if (!name || birthDate.length !== 8 || !gender) {
    return null;
  }

  return {
    identityVerificationId,
    name,
    birthDate,
    gender,
  };
}
