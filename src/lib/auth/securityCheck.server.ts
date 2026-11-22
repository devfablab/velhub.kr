import crypto from 'crypto';
import { type AccessContext, getAccessContext, getAccessContextKey } from '@/lib/auth/accessContext';
import { createSecurityPinHash } from '@/lib/auth/securityPin.server';
import { getRecoveryRecipient } from '@/lib/auth/totpRecovery.server';
import { redis } from '@/lib/clients/redis';
import { getMailFrom, getResendClient } from '@/lib/clients/resend';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { createLookupHash } from '@/lib/encryption/encrypt';
import type { SessionClaims } from '@/lib/session/server';

type HeaderReader = {
  get(name: string): string | null;
};

type SessionSecurityRecord = {
  verifiedContextKeys: string[];
  settingsVerifiedUntil: number;
};

type KnownAccessContexts = {
  regions: string[];
  devices: string[];
};

export type SecurityState = {
  revoked: boolean;
  needsAccessCheck: boolean;
  isSettingsVerified: boolean;
};

export type SecurityCheckMethods = {
  password: boolean;
  totp: boolean;
  emailPin: boolean;
};

export const SECURITY_CHECK_FAILURE_LIMIT = 5;
export { SECURITY_CHECK_REQUIRED_CODE, SETTINGS_CHECK_REQUIRED_CODE } from '@/lib/auth/accessContext';

const SESSION_RECORD_SECONDS = 60 * 60 * 24 * 30;
const KNOWN_CONTEXTS_CACHE_SECONDS = 60 * 60 * 24;
const SETTINGS_VERIFIED_MS = 60 * 60 * 1000;
const FAILURE_WINDOW_SECONDS = 60 * 60 * 24;
const EMAIL_CODE_SECONDS = 60 * 5;
const REVOKED_SECONDS = 60 * 60 * 2;
const FRESH_PASSWORD_SIGN_IN_MS = 10 * 60 * 1000;
const MAX_VERIFIED_CONTEXT_KEYS = 20;

const EMPTY_SECURITY_STATE: SecurityState = {
  revoked: false,
  needsAccessCheck: false,
  isSettingsVerified: false,
};

function getSessionRecordKey(sessionId: string) {
  return `security:session:${sessionId}`;
}

function getKnownContextsKey(userId: string) {
  return `security:known:${userId}`;
}

function getFailureKey(userId: string) {
  return `security:failures:${userId}`;
}

function getEmailCodeKey(sessionId: string) {
  return `security:email-code:${sessionId}`;
}

function getRevokedKey(userId: string) {
  return `security:revoked:${userId}`;
}

function getEmailCodeHash(sessionId: string, code: string) {
  return createLookupHash(`security-email-code:${sessionId}:${code}`);
}

function isSameHash(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function getSessionSecurityRecord(sessionId: string) {
  return redis.get<SessionSecurityRecord>(getSessionRecordKey(sessionId));
}

async function saveSessionSecurityRecord(sessionId: string, record: SessionSecurityRecord) {
  await redis.set(getSessionRecordKey(sessionId), record, { ex: SESSION_RECORD_SECONDS });
}

async function getKnownAccessContexts(userId: string): Promise<KnownAccessContexts> {
  const cachedContexts = await redis.get<KnownAccessContexts>(getKnownContextsKey(userId));

  if (cachedContexts) {
    return cachedContexts;
  }

  const contextResult = await getSupabaseAdmin()
    .from('stigma_access_contexts')
    .select('context_type, context_key')
    .eq('user_id', userId);

  if (contextResult.error) {
    throw new Error('접속 기록을 확인하지 못했습니다.');
  }

  const contexts: KnownAccessContexts = {
    regions: (contextResult.data ?? [])
      .filter((context) => context.context_type === 'region')
      .map((context) => context.context_key as string),
    devices: (contextResult.data ?? [])
      .filter((context) => context.context_type === 'device')
      .map((context) => context.context_key as string),
  };

  await redis.set(getKnownContextsKey(userId), contexts, { ex: KNOWN_CONTEXTS_CACHE_SECONDS });

  return contexts;
}

async function rememberAccessContext(userId: string, context: AccessContext) {
  const now = new Date().toISOString();
  const upsertResult = await getSupabaseAdmin()
    .from('stigma_access_contexts')
    .upsert(
      [
        { user_id: userId, context_type: 'region', context_key: context.regionKey, last_seen_at: now },
        { user_id: userId, context_type: 'device', context_key: context.deviceKey, last_seen_at: now },
      ],
      { onConflict: 'user_id,context_type,context_key' },
    );

  if (upsertResult.error) {
    throw new Error('접속 기록을 저장하지 못했습니다.');
  }

  await redis.del(getKnownContextsKey(userId));
}

async function trustSessionContext(sessionId: string, record: SessionSecurityRecord | null, contextKey: string) {
  const verifiedContextKeys = (record?.verifiedContextKeys ?? []).filter((key) => key !== contextKey);

  await saveSessionSecurityRecord(sessionId, {
    verifiedContextKeys: [...verifiedContextKeys, contextKey].slice(-MAX_VERIFIED_CONTEXT_KEYS),
    settingsVerifiedUntil: record?.settingsVerifiedUntil ?? 0,
  });
}

async function isSessionRevoked(sessionClaims: SessionClaims) {
  const revokedAt = await redis.get<number>(getRevokedKey(sessionClaims.userId));

  if (!revokedAt) {
    return false;
  }

  const issuedAt = sessionClaims.issuedAt ?? null;
  return !issuedAt || issuedAt * 1000 <= revokedAt;
}

export async function getReadSecurityState(
  sessionClaims: SessionClaims | null,
  shouldCheckSettings: boolean,
): Promise<SecurityState> {
  if (!sessionClaims?.userId || !sessionClaims.sessionId) {
    return EMPTY_SECURITY_STATE;
  }

  if (await isSessionRevoked(sessionClaims)) {
    return { ...EMPTY_SECURITY_STATE, revoked: true };
  }

  if (!shouldCheckSettings) {
    return EMPTY_SECURITY_STATE;
  }

  const record = await getSessionSecurityRecord(sessionClaims.sessionId);
  return { ...EMPTY_SECURITY_STATE, isSettingsVerified: (record?.settingsVerifiedUntil ?? 0) > Date.now() };
}

export async function getSecurityState(
  sessionClaims: SessionClaims | null,
  headerList: HeaderReader,
): Promise<SecurityState> {
  if (!sessionClaims?.userId || !sessionClaims.sessionId) {
    return EMPTY_SECURITY_STATE;
  }

  if (await isSessionRevoked(sessionClaims)) {
    return { ...EMPTY_SECURITY_STATE, revoked: true };
  }

  const context = getAccessContext(headerList);
  const contextKey = getAccessContextKey(context);
  const record = await getSessionSecurityRecord(sessionClaims.sessionId);
  const now = Date.now();

  if (record?.verifiedContextKeys.includes(contextKey)) {
    return { ...EMPTY_SECURITY_STATE, isSettingsVerified: record.settingsVerifiedUntil > now };
  }

  const knownContexts = await getKnownAccessContexts(sessionClaims.userId);
  const isFirstContext = knownContexts.regions.length === 0 && knownContexts.devices.length === 0;
  const isKnownContext =
    knownContexts.regions.includes(context.regionKey) && knownContexts.devices.includes(context.deviceKey);
  const passwordSignedInAt = sessionClaims.passwordSignedInAt ?? null;
  const isFreshPasswordSession = Boolean(
    !record && passwordSignedInAt && now - passwordSignedInAt * 1000 < FRESH_PASSWORD_SIGN_IN_MS,
  );

  if (isFirstContext || isKnownContext || isFreshPasswordSession) {
    if (!isKnownContext) {
      await rememberAccessContext(sessionClaims.userId, context);
    }

    await trustSessionContext(sessionClaims.sessionId, record, contextKey);

    return { ...EMPTY_SECURITY_STATE, isSettingsVerified: (record?.settingsVerifiedUntil ?? 0) > now };
  }

  if (record?.settingsVerifiedUntil) {
    await saveSessionSecurityRecord(sessionClaims.sessionId, { ...record, settingsVerifiedUntil: 0 });
  }

  return { ...EMPTY_SECURITY_STATE, needsAccessCheck: true };
}

export async function completeAccessCheck(sessionClaims: SessionClaims, headerList: HeaderReader) {
  if (!sessionClaims.sessionId) {
    throw new Error('로그인 정보를 확인하지 못했습니다.');
  }

  const context = getAccessContext(headerList);
  const record = await getSessionSecurityRecord(sessionClaims.sessionId);

  await rememberAccessContext(sessionClaims.userId, context);
  await trustSessionContext(sessionClaims.sessionId, record, getAccessContextKey(context));
}

export async function completeSettingsCheck(sessionClaims: SessionClaims, headerList: HeaderReader) {
  if (!sessionClaims.sessionId) {
    throw new Error('로그인 정보를 확인하지 못했습니다.');
  }

  const contextKey = getAccessContextKey(getAccessContext(headerList));
  const record = await getSessionSecurityRecord(sessionClaims.sessionId);
  const verifiedContextKeys = record?.verifiedContextKeys ?? [];

  await saveSessionSecurityRecord(sessionClaims.sessionId, {
    verifiedContextKeys: verifiedContextKeys.includes(contextKey)
      ? verifiedContextKeys
      : [...verifiedContextKeys, contextKey].slice(-MAX_VERIFIED_CONTEXT_KEYS),
    settingsVerifiedUntil: Date.now() + SETTINGS_VERIFIED_MS,
  });
}

export async function getSecurityCheckMethods(userId: string, hasTotp: boolean): Promise<SecurityCheckMethods> {
  const authUserResult = await getSupabaseAdmin().auth.admin.getUserById(userId);

  if (authUserResult.error || !authUserResult.data.user) {
    throw new Error('계정 정보를 확인하지 못했습니다.');
  }

  const hasPassword = Boolean(authUserResult.data.user.identities?.some((identity) => identity.provider === 'email'));

  return {
    password: hasPassword,
    totp: hasTotp,
    emailPin: !hasPassword && !hasTotp,
  };
}

export async function sendSecurityEmailCode(userId: string, sessionId: string) {
  const email = await getRecoveryRecipient(userId).catch(() => {
    throw new Error('인증번호를 받을 이메일을 확인하지 못했습니다.');
  });
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const sendResult = await getResendClient().emails.send({
    from: getMailFrom(),
    to: email,
    subject: '[데브허브] 본인 확인 인증번호',
    html: `<div style="font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#181818;line-height:1.6"><h1>본인 확인 인증번호</h1><p>아래 6자리 인증번호를 본인 확인 화면에 입력해 주세요. 인증번호는 5분 동안만 쓸 수 있습니다.</p><p style="font-size:28px;font-weight:700;letter-spacing:8px">${code}</p><p>직접 요청하지 않았다면 다른 사람이 계정에 접속하려는 것일 수 있습니다. 보안 비밀번호를 다른 사람에게 알려 주지 마세요.</p></div>`,
  });

  if (sendResult.error) {
    console.error('[security-check] email send error', sendResult.error);
    throw new Error('인증번호를 이메일로 보내지 못했습니다.');
  }

  await redis.set(getEmailCodeKey(sessionId), getEmailCodeHash(sessionId, code), { ex: EMAIL_CODE_SECONDS });

  return email.replace(/^(.{2})[^@]*(@.*)$/, '$1***$2');
}

export async function verifySecurityEmailCode(sessionId: string, code: string) {
  const savedHash = await redis.get<string>(getEmailCodeKey(sessionId));
  return Boolean(savedHash && isSameHash(savedHash, getEmailCodeHash(sessionId, code)));
}

export async function clearSecurityEmailCode(sessionId: string) {
  await redis.del(getEmailCodeKey(sessionId));
}

export async function verifySecurityPin(userId: string, pin: string) {
  const stigmaResult = await getSupabaseAdmin()
    .from('stigmas')
    .select('security_pin_hash')
    .eq('user_id', userId)
    .maybeSingle();

  if (stigmaResult.error) {
    throw new Error('보안 비밀번호를 확인하지 못했습니다.');
  }

  const savedHash = stigmaResult.data?.security_pin_hash as string | null | undefined;
  return Boolean(savedHash && isSameHash(savedHash, createSecurityPinHash(userId, pin)));
}

export async function recordSecurityCheckFailure(userId: string) {
  const failureKey = getFailureKey(userId);
  const failureCount = await redis.incr(failureKey);

  if (failureCount === 1) {
    await redis.expire(failureKey, FAILURE_WINDOW_SECONDS);
  }

  return failureCount;
}

export async function clearSecurityCheckFailures(userId: string) {
  await redis.del(getFailureKey(userId));
}

export async function revokeAllSessions(sessionClaims: SessionClaims) {
  await redis.set(getRevokedKey(sessionClaims.userId), Date.now(), { ex: REVOKED_SECONDS });
  await redis.del(getFailureKey(sessionClaims.userId));

  if (sessionClaims.sessionId) {
    await redis.del(getSessionRecordKey(sessionClaims.sessionId), getEmailCodeKey(sessionClaims.sessionId));
  }
}
