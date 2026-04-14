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
  if (pathname.startsWith('/api')) {
    return false;
  }

  const segments = pathname.split('/').filter(Boolean);

  return (
    segments.length >= 2 &&
    (segments[1] === 'contents' || segments[1] === 'design' || segments[1] === 'team' || segments[1] === 'manage')
  );
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
    firstSegment === '.well-known' ||
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

  return segments[1] === 'contents' || segments[1] === 'design' || segments[1] === 'team' || segments[1] === 'manage';
}

function isInviteBlogPath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);

  return segments.length >= 3 && segments[1] === 'invite-blog';
}

function isForbiddenPath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);

  return segments.length >= 2 && segments[1] === 'forbidden';
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

async function fetchRhizomeState(request: NextRequest, siteName: string) {
  const targetUrl = new URL('/api/site/public', request.url);
  targetUrl.searchParams.set('siteName', siteName);

  const response = await fetch(targetUrl, {
    method: 'GET',
    headers: {
      cookie: request.headers.get('cookie') ?? '',
    },
  });

  let result: {
    rhizomes?: {
      visibility_type?: string | null;
      is_shutdown?: boolean | null;
    };
  } | null = null;

  try {
    result = (await response.json()) as {
      rhizomes?: {
        visibility_type?: string | null;
        is_shutdown?: boolean | null;
      };
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

  const claims = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(claims.data?.claims?.sub);

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

    const admin = await fetchSessionRoute(request, '/api/session/admin', {});

    if (admin.response.status === 401) {
      return redirectWithPath(request, '/auth/sign-in');
    }

    if (!admin.response.ok) {
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

    const staff = await fetchSessionRoute(request, '/api/session/staff', {
      siteName,
    });

    if (staff.response.status === 401) {
      return redirectWithPath(request, '/auth/sign-in');
    }

    if (!staff.response.ok) {
      return redirectWithPath(request, `/${siteName}`);
    }

    return response;
  }

  if (isSitePath(request.nextUrl.pathname)) {
    const siteName = getSiteNameFromPath(request.nextUrl.pathname).trim().toLowerCase();

    if (!siteName) {
      return response;
    }

    if (isInviteBlogPath(request.nextUrl.pathname)) {
      return response;
    }

    const rhizome = await fetchRhizomeState(request, siteName);

    if (!rhizome.response.ok || !rhizome.result?.rhizomes) {
      return response;
    }

    const isPublicReadable =
      rhizome.result.rhizomes.visibility_type === 'public' && rhizome.result.rhizomes.is_shutdown === false;

    if (!isPublicReadable) {
      if (!isLoggedIn) {
        return redirectWithPath(request, `/${siteName}/forbidden`);
      }

      const staff = await fetchSessionRoute(request, '/api/session/staff', {
        siteName,
      });

      if (!staff.response.ok) {
        return redirectWithPath(request, `/${siteName}/forbidden`);
      }

      if (isForbiddenPath(request.nextUrl.pathname)) {
        return response;
      }

      return response;
    }

    if (isForbiddenPath(request.nextUrl.pathname)) {
      return redirectWithPath(request, `/${siteName}`);
    }

    if (isSiteStaffOnlyPath(request.nextUrl.pathname)) {
      if (!isLoggedIn) {
        return redirectWithPath(request, `/${siteName}`);
      }

      const staff = await fetchSessionRoute(request, '/api/session/staff', {
        siteName,
      });

      if (!staff.response.ok) {
        return redirectWithPath(request, `/${siteName}`);
      }

      return response;
    }

    if (isLoggedIn) {
      const staff = await fetchSessionRoute(request, '/api/session/staff', {
        siteName,
      });

      if (staff.response.ok) {
        return response;
      }

      const member = await fetchSessionRoute(request, '/api/session/member', {
        siteName,
        pathname: request.nextUrl.pathname,
      });

      if (member.response.ok && member.result?.allow) {
        return response;
      }

      if (member.response.ok && member.result && member.result.allow === false) {
        return redirectWithPath(request, member.result.redirectTo || `/${siteName}`);
      }

      const guestSite = await fetchSessionRoute(request, '/api/session/guest-site', {
        siteName,
        pathname: request.nextUrl.pathname,
      });

      if (guestSite.response.ok && guestSite.result?.allow) {
        return response;
      }

      if (guestSite.response.ok && guestSite.result && guestSite.result.allow === false) {
        return redirectWithPath(request, guestSite.result.redirectTo || `/${siteName}/join`);
      }

      return redirectWithPath(request, `/${siteName}`);
    }

    const guestPublic = await fetchSessionRoute(request, '/api/session/guest-public', {
      siteName,
      pathname: request.nextUrl.pathname,
    });

    if (guestPublic.response.ok && guestPublic.result?.allow) {
      return response;
    }

    if (guestPublic.response.ok && guestPublic.result && guestPublic.result.allow === false) {
      return redirectWithPath(request, guestPublic.result.redirectTo || '/auth/sign-in');
    }

    return redirectWithPath(request, '/auth/sign-in');
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|\\.well-known|api/session/admin|api/session/staff|api/session/member|api/session/guest-site|api/session/guest-public|api/site/public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
