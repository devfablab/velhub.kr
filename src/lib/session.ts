import { createHash } from 'crypto';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { redis } from '@/lib/redis';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SessionClaims = {
  userId: string;
  email: string | null;
  sessionId: string | null;
  authenticationLevel: string | null;
  role: string | null;
  expiresAt: number | null;
  autoLogin: boolean;
  lastActiveAt: number;
};

type CookieStore = Awaited<ReturnType<typeof cookies>>;
type CookieSetArguments = Parameters<CookieStore['set']>;
type CookieOptions = CookieSetArguments[2];

type CookieToSet = {
  name: string;
  value: string;
  options?: CookieOptions;
};

type CookieLike = {
  name: string;
  value: string;
};

const DEFAULT_AUTO_LOGIN = true;
const SESSION_CACHE_SECONDS = 60 * 10;
const PROFILE_AUTO_LOGIN_CACHE_SECONDS = 60 * 10;
const LAST_ACTIVE_TOUCH_SECONDS = 60 * 5;
const AUTO_LOGIN_ON_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;
const AUTO_LOGIN_OFF_TIMEOUT_MS = 24 * 60 * 60 * 1000;

function getSupabaseUrl() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다.');
  }

  return supabaseUrl;
}

function getSupabaseBrowserKey() {
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabasePublishableKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다.');
  }

  return supabasePublishableKey;
}

function getSessionClaimsCacheKey(cookieFingerprint: string) {
  return `session:claims:${cookieFingerprint}`;
}

function getLastActiveCacheKey(userId: string) {
  return `session:last-active:${userId}`;
}

function getProfileAutoLoginCacheKey(userId: string) {
  return `session:auto-login:${userId}`;
}

function getAuthCookieFingerprint(cookieItems: CookieLike[]) {
  const authCookieValue = cookieItems
    .filter((cookieItem) => cookieItem.name.includes('-auth-token'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((cookieItem) => `${cookieItem.name}=${cookieItem.value}`)
    .join('|');

  if (!authCookieValue) {
    return '';
  }

  return createHash('sha256').update(authCookieValue).digest('hex');
}

function isExpired(expiresAt: number | null) {
  if (!expiresAt) {
    return false;
  }

  return Date.now() >= expiresAt * 1000;
}

function getInactiveTimeoutMs(autoLogin: boolean) {
  return autoLogin ? AUTO_LOGIN_ON_TIMEOUT_MS : AUTO_LOGIN_OFF_TIMEOUT_MS;
}

function getLastActiveExpireSeconds(autoLogin: boolean) {
  return Math.floor(getInactiveTimeoutMs(autoLogin) / 1000);
}

function isInactive(lastActiveAt: number, autoLogin: boolean) {
  return Date.now() - lastActiveAt >= getInactiveTimeoutMs(autoLogin);
}

function shouldTouchLastActive(lastActiveAt: number) {
  return Date.now() - lastActiveAt >= LAST_ACTIVE_TOUCH_SECONDS * 1000;
}

async function getUserAutoLogin(userId: string) {
  const cachedAutoLogin = await redis.get<boolean>(getProfileAutoLoginCacheKey(userId));

  if (typeof cachedAutoLogin === 'boolean') {
    return cachedAutoLogin;
  }

  const supabaseAdmin = getSupabaseAdmin();

  const profileResult = await supabaseAdmin.from('profiles').select('auto_login').eq('user_id', userId).maybeSingle();

  if (profileResult.error) {
    return DEFAULT_AUTO_LOGIN;
  }

  const autoLogin =
    typeof profileResult.data?.auto_login === 'boolean' ? profileResult.data.auto_login : DEFAULT_AUTO_LOGIN;

  await redis.set(getProfileAutoLoginCacheKey(userId), autoLogin, {
    ex: PROFILE_AUTO_LOGIN_CACHE_SECONDS,
  });

  return autoLogin;
}

async function touchLastActive(userId: string, autoLogin: boolean) {
  const nextLastActiveAt = Date.now();

  await redis.set(getLastActiveCacheKey(userId), nextLastActiveAt, {
    ex: getLastActiveExpireSeconds(autoLogin),
  });

  return nextLastActiveAt;
}

async function clearSessionCacheByFingerprint(cookieFingerprint: string | null | undefined) {
  const normalizedFingerprint = normalizeText(cookieFingerprint);

  if (!normalizedFingerprint) {
    return;
  }

  await redis.del(getSessionClaimsCacheKey(normalizedFingerprint));
}

async function buildSessionClaimsFromAuthClaims(
  claims: {
    sub?: string;
    email?: string;
    session_id?: string;
    aal?: string;
    role?: string;
    exp?: number;
  },
  cookieFingerprint: string,
) {
  if (!claims.sub) {
    return null;
  }

  const autoLogin = await getUserAutoLogin(claims.sub);
  const storedLastActiveAt = await redis.get<number>(getLastActiveCacheKey(claims.sub));
  const lastActiveAt = typeof storedLastActiveAt === 'number' ? storedLastActiveAt : Date.now();

  if (isInactive(lastActiveAt, autoLogin)) {
    await clearSessionCacheByFingerprint(cookieFingerprint);
    await redis.del(getLastActiveCacheKey(claims.sub));
    return null;
  }

  const nextLastActiveAt = shouldTouchLastActive(lastActiveAt)
    ? await touchLastActive(claims.sub, autoLogin)
    : lastActiveAt;

  const sessionClaims: SessionClaims = {
    userId: claims.sub,
    email: claims.email ?? null,
    sessionId: claims.session_id ?? null,
    authenticationLevel: claims.aal ?? null,
    role: claims.role ?? null,
    expiresAt: claims.exp ?? null,
    autoLogin,
    lastActiveAt: nextLastActiveAt,
  };

  await redis.set(getSessionClaimsCacheKey(cookieFingerprint), sessionClaims, {
    ex: SESSION_CACHE_SECONDS,
  });

  return sessionClaims;
}

async function getCachedSessionClaims(cookieItems: CookieLike[]) {
  const cookieFingerprint = getAuthCookieFingerprint(cookieItems);

  if (!cookieFingerprint) {
    return null;
  }

  const cachedSessionClaims = await redis.get<SessionClaims>(getSessionClaimsCacheKey(cookieFingerprint));

  if (!cachedSessionClaims) {
    return null;
  }

  if (isExpired(cachedSessionClaims.expiresAt)) {
    await clearSessionCacheByFingerprint(cookieFingerprint);
    return null;
  }

  const autoLogin = await getUserAutoLogin(cachedSessionClaims.userId);
  const storedLastActiveAt = await redis.get<number>(getLastActiveCacheKey(cachedSessionClaims.userId));
  const lastActiveAt =
    typeof storedLastActiveAt === 'number' ? storedLastActiveAt : (cachedSessionClaims.lastActiveAt ?? Date.now());

  if (isInactive(lastActiveAt, autoLogin)) {
    await clearSessionCacheByFingerprint(cookieFingerprint);
    await redis.del(getLastActiveCacheKey(cachedSessionClaims.userId));
    return null;
  }

  const nextLastActiveAt = shouldTouchLastActive(lastActiveAt)
    ? await touchLastActive(cachedSessionClaims.userId, autoLogin)
    : lastActiveAt;

  const nextSessionClaims: SessionClaims = {
    ...cachedSessionClaims,
    autoLogin,
    lastActiveAt: nextLastActiveAt,
  };

  await redis.set(getSessionClaimsCacheKey(cookieFingerprint), nextSessionClaims, {
    ex: SESSION_CACHE_SECONDS,
  });

  return nextSessionClaims;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const cachedSessionClaims = await getCachedSessionClaims(request.cookies.getAll());

  if (cachedSessionClaims) {
    return {
      response,
      sessionClaims: cachedSessionClaims,
    };
  }

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseBrowserKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }: CookieToSet) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }: CookieToSet) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const claimsResult = await supabase.auth.getClaims();

  if (claimsResult.error || !claimsResult.data?.claims) {
    return {
      response,
      sessionClaims: null,
    };
  }

  const claims = claimsResult.data.claims as {
    sub?: string;
    email?: string;
    session_id?: string;
    aal?: string;
    role?: string;
    exp?: number;
  };

  const cookieFingerprint = getAuthCookieFingerprint(request.cookies.getAll());

  if (!cookieFingerprint) {
    return {
      response,
      sessionClaims: null,
    };
  }

  const sessionClaims = await buildSessionClaimsFromAuthClaims(claims, cookieFingerprint);

  return {
    response,
    sessionClaims,
  };
}

export async function getSessionClaims() {
  const cookieStore = await cookies();
  const cookieItems = cookieStore.getAll();

  const cachedSessionClaims = await getCachedSessionClaims(cookieItems);

  if (cachedSessionClaims) {
    return cachedSessionClaims;
  }

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseBrowserKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }: CookieToSet) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          return;
        }
      },
    },
  });

  const claimsResult = await supabase.auth.getClaims();

  if (claimsResult.error || !claimsResult.data?.claims) {
    return null;
  }

  const claims = claimsResult.data.claims as {
    sub?: string;
    email?: string;
    session_id?: string;
    aal?: string;
    role?: string;
    exp?: number;
  };

  const cookieFingerprint = getAuthCookieFingerprint(cookieStore.getAll());

  if (!cookieFingerprint) {
    return null;
  }

  return buildSessionClaimsFromAuthClaims(claims, cookieFingerprint);
}

export async function clearSessionClaimsCache(sessionId: string | null) {
  const normalizedSessionId = normalizeText(sessionId);

  if (!normalizedSessionId) {
    return;
  }

  await redis.del(`session:claims:legacy:${normalizedSessionId}`);
}
