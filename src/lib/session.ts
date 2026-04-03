import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { redis } from '@/lib/redis';

type SessionClaims = {
  userId: string;
  email: string | null;
  sessionId: string | null;
  authenticationLevel: string | null;
  role: string | null;
  expiresAt: number | null;
};

type CookieStore = Awaited<ReturnType<typeof cookies>>;
type CookieSetArguments = Parameters<CookieStore['set']>;
type CookieOptions = CookieSetArguments[2];

type CookieToSet = {
  name: string;
  value: string;
  options?: CookieOptions;
};

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

function getSessionCacheKey(sessionId: string) {
  return `session:claims:${sessionId}`;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

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

  await supabase.auth.getClaims();

  return response;
}

export async function getSessionClaims() {
  const cookieStore = await cookies();

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

  if (!claims.sub) {
    return null;
  }

  if (claims.session_id) {
    const cachedSessionClaims = await redis.get<SessionClaims>(getSessionCacheKey(claims.session_id));

    if (cachedSessionClaims) {
      return cachedSessionClaims;
    }
  }

  const sessionClaims: SessionClaims = {
    userId: claims.sub,
    email: claims.email ?? null,
    sessionId: claims.session_id ?? null,
    authenticationLevel: claims.aal ?? null,
    role: claims.role ?? null,
    expiresAt: claims.exp ?? null,
  };

  if (sessionClaims.sessionId) {
    await redis.set(getSessionCacheKey(sessionClaims.sessionId), sessionClaims, {
      ex: 60 * 5,
    });
  }

  return sessionClaims;
}

export async function clearSessionClaimsCache(sessionId: string | null) {
  if (!sessionId) {
    return;
  }

  await redis.del(getSessionCacheKey(sessionId));
}
