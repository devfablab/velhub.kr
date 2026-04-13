import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

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

function isManagePath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);

  return segments.length >= 2 && segments[1] === 'manage';
}

function getSiteNameFromPath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);

  return segments[0] ?? '';
}

function isConciergeAdminPath(pathname: string) {
  return pathname.startsWith('/concierge/admin');
}

function isReservedRootPath(pathname: string) {
  const firstSegment = pathname.split('/').filter(Boolean)[0] ?? '';

  return (
    firstSegment === '' ||
    firstSegment === 'auth' ||
    firstSegment === 'settings' ||
    firstSegment === 'new' ||
    firstSegment === 'concierge'
  );
}

function isSitePath(pathname: string) {
  if (pathname.startsWith('/api')) {
    return false;
  }

  if (isConciergeAdminPath(pathname)) {
    return false;
  }

  if (isReservedRootPath(pathname)) {
    return false;
  }

  return pathname.startsWith('/');
}

function isSiteStaffOnlyPath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length < 2) {
    return false;
  }

  return segments[1] === 'contents' || segments[1] === 'design' || segments[1] === 'manage';
}

async function fetchSessionRoute(request: NextRequest, pathname: string, query: Record<string, string>) {
  const targetUrl = new URL(pathname, request.url);

  Object.entries(query).forEach(([key, value]) => {
    targetUrl.searchParams.set(key, value);
  });

  const response = await fetch(targetUrl, {
    method: 'GET',
    headers: {
      cookie: request.headers.get('cookie') ?? '',
    },
  });

  let result: {
    ok: boolean;
    allow?: boolean;
    redirectTo?: string | null;
  } | null = null;

  try {
    result = (await response.json()) as {
      ok: boolean;
      allow?: boolean;
      redirectTo?: string | null;
    };
  } catch {
    result = null;
  }

  return {
    response,
    result,
  };
}

function redirectWithPath(request: NextRequest, pathname: string) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = pathname;
  redirectUrl.search = '';

  return NextResponse.redirect(redirectUrl);
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseBrowserKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies) {
        cookies.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request,
        });

        cookies.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const claimsResult = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(claimsResult.data?.claims?.sub);

  if (request.nextUrl.pathname.startsWith('/new') || request.nextUrl.pathname.startsWith('/settings')) {
    if (!isLoggedIn) {
      return redirectWithPath(request, '/auth/sign-in');
    }

    return response;
  }

  if (isConciergeAdminPath(request.nextUrl.pathname)) {
    if (!isLoggedIn) {
      return redirectWithPath(request, '/auth/sign-in');
    }

    const adminCheck = await fetchSessionRoute(request, '/api/session/admin', {});

    if (adminCheck.response.status === 401) {
      return redirectWithPath(request, '/auth/sign-in');
    }

    if (!adminCheck.response.ok) {
      return redirectWithPath(request, '/');
    }

    return response;
  }

  if (isManagePath(request.nextUrl.pathname)) {
    if (!isLoggedIn) {
      return redirectWithPath(request, '/auth/sign-in');
    }

    const siteName = getSiteNameFromPath(request.nextUrl.pathname).trim().toLowerCase();

    if (!siteName) {
      return redirectWithPath(request, '/');
    }

    const staffCheck = await fetchSessionRoute(request, '/api/session/staff', {
      siteName,
    });

    if (staffCheck.response.status === 401) {
      return redirectWithPath(request, '/auth/sign-in');
    }

    if (!staffCheck.response.ok) {
      return redirectWithPath(request, `/${siteName}`);
    }

    return response;
  }

  if (isSitePath(request.nextUrl.pathname)) {
    const siteName = getSiteNameFromPath(request.nextUrl.pathname).trim().toLowerCase();

    if (!siteName) {
      return response;
    }

    if (isSiteStaffOnlyPath(request.nextUrl.pathname)) {
      if (!isLoggedIn) {
        return redirectWithPath(request, `/${siteName}`);
      }

      const staffCheck = await fetchSessionRoute(request, '/api/session/staff', {
        siteName,
      });

      if (!staffCheck.response.ok) {
        return redirectWithPath(request, `/${siteName}`);
      }

      return response;
    }

    if (isLoggedIn) {
      const staffCheck = await fetchSessionRoute(request, '/api/session/staff', {
        siteName,
      });

      if (staffCheck.response.ok) {
        return response;
      }

      const memberCheck = await fetchSessionRoute(request, '/api/session/member', {
        siteName,
        pathname: request.nextUrl.pathname,
      });

      if (memberCheck.response.ok && memberCheck.result?.allow) {
        return response;
      }

      if (memberCheck.response.ok && memberCheck.result && memberCheck.result.allow === false) {
        return redirectWithPath(request, memberCheck.result.redirectTo || `/${siteName}`);
      }

      const guestSiteCheck = await fetchSessionRoute(request, '/api/session/guest-site', {
        siteName,
        pathname: request.nextUrl.pathname,
      });

      if (guestSiteCheck.response.ok && guestSiteCheck.result?.allow) {
        return response;
      }

      if (guestSiteCheck.response.ok && guestSiteCheck.result && guestSiteCheck.result.allow === false) {
        return redirectWithPath(request, guestSiteCheck.result.redirectTo || `/${siteName}/join`);
      }

      return redirectWithPath(request, `/${siteName}`);
    }

    const guestPublicCheck = await fetchSessionRoute(request, '/api/session/guest-public', {
      siteName,
      pathname: request.nextUrl.pathname,
    });

    if (guestPublicCheck.response.ok && guestPublicCheck.result?.allow) {
      return response;
    }

    if (guestPublicCheck.response.ok && guestPublicCheck.result && guestPublicCheck.result.allow === false) {
      return redirectWithPath(request, guestPublicCheck.result.redirectTo || '/auth/sign-in');
    }

    return redirectWithPath(request, '/auth/sign-in');
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|\\.well-known|api/session/admin|api/session/staff|api/session/member|api/session/guest-site|api/session/guest-public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
