import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/session';

function isManagePath(pathname: string) {
  if (pathname.startsWith('/api')) {
    return false;
  }

  const segments = pathname.split('/').filter(Boolean);

  return segments.length >= 2 && segments[1] === 'manage';
}

function isJoinPath(pathname: string) {
  if (pathname.startsWith('/api')) {
    return false;
  }

  const segments = pathname.split('/').filter(Boolean);

  return segments.length === 2 && segments[1] === 'join';
}

function getSiteNameFromPath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);

  return segments[0] ?? '';
}

function isReservedRootPath(pathname: string) {
  const firstSegment = pathname.split('/').filter(Boolean)[0] ?? '';

  return (
    firstSegment === '' ||
    firstSegment === '_next' ||
    firstSegment === 'favicon.ico' ||
    firstSegment === 'broken-image.jpg' ||
    firstSegment === '.well-known' ||
    firstSegment === 'auth' ||
    firstSegment === 'settings' ||
    firstSegment === 'new' ||
    firstSegment === 'concierge' ||
    firstSegment === 'hub' ||
    firstSegment === 'dummy.webp'
  );
}

function isSitePath(pathname: string) {
  if (pathname.startsWith('/api')) {
    return false;
  }

  if (isReservedRootPath(pathname)) {
    return false;
  }

  return pathname.startsWith('/');
}

function isInviteBlogPath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);

  return segments.length >= 3 && segments[1] === 'invite-blog';
}

function isSiteStatusPath(pathname: string, siteName: string) {
  return (
    pathname === `/${siteName}/unpaid` || pathname === `/${siteName}/closed` || pathname === `/${siteName}/suspended`
  );
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
    role?: string | null;
  } | null = null;

  try {
    result = (await response.json()) as {
      ok: boolean;
      allow?: boolean;
      redirectTo?: string | null;
      role?: string | null;
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
    siteInfo?: {
      visibility_type?: string | null;
      is_shutdown?: boolean | null;
      is_blocked?: boolean | null;
      site_type?: string | null;
    };
  } | null = null;

  try {
    result = (await response.json()) as {
      siteInfo?: {
        visibility_type?: string | null;
        is_shutdown?: boolean | null;
        is_blocked?: boolean | null;
        site_type?: string | null;
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

function getShutdownRedirectPath({
  siteName,
  isSiteOwner,
  isBlocked,
}: {
  siteName: string;
  isSiteOwner: boolean;
  isBlocked: boolean | null | undefined;
}) {
  if (!isSiteOwner) {
    return `/${siteName}/suspended`;
  }

  if (isBlocked === true) {
    return `/${siteName}/closed`;
  }

  return `/${siteName}/unpaid`;
}

export async function proxy(request: NextRequest) {
  const { response, sessionClaims } = await updateSession(request);
  const pathname = request.nextUrl.pathname;
  const isLoggedIn = Boolean(sessionClaims?.userId);
  const isAal1 = sessionClaims?.authenticationLevel === 'aal1';
  const hasTotp = sessionClaims?.hasTotp === true;

  if (pathname === '/auth/sign-in' || pathname === '/auth/sign-up' || pathname === '/auth') {
    if (isLoggedIn) {
      return redirectWithPath(request, '/');
    }

    return response;
  }

  if (isLoggedIn && isAal1 && hasTotp) {
    if (pathname.startsWith('/api') && !pathname.startsWith('/api/auth')) {
      return new NextResponse(JSON.stringify({ error: '2FA verification required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return response;
  }

  if (pathname.startsWith('/settings') || pathname.startsWith('/new') || pathname.startsWith('/hub')) {
    if (!isLoggedIn) {
      return redirectWithPath(request, '/auth/sign-in');
    }

    return response;
  }

  if (isSitePath(pathname) && !isInviteBlogPath(pathname)) {
    const siteName = getSiteNameFromPath(pathname).trim().toLowerCase();

    if (siteName) {
      const rhizomeState = await fetchRhizomeState(request, siteName);

      if (rhizomeState.response.ok && rhizomeState.result?.siteInfo) {
        const isStatusPath = isSiteStatusPath(pathname, siteName);

        if (rhizomeState.result.siteInfo.is_shutdown !== true) {
          if (isStatusPath) {
            return redirectWithPath(request, `/${siteName}`);
          }
        } else {
          let isSiteOwner = false;

          if (isLoggedIn) {
            const staff = await fetchSessionRoute(request, '/api/session/staff', { siteName });
            isSiteOwner = staff.response.ok && staff.result?.role === 'owner';
          }

          if (
            !(
              isSiteOwner &&
              (rhizomeState.result.siteInfo.is_blocked === null || rhizomeState.result.siteInfo.is_blocked === false) &&
              isManagePath(pathname)
            )
          ) {
            const redirectPath = getShutdownRedirectPath({
              siteName,
              isSiteOwner,
              isBlocked: rhizomeState.result.siteInfo.is_blocked,
            });

            if (pathname !== redirectPath) {
              return redirectWithPath(request, redirectPath);
            }

            return response;
          }
        }
      }
    }
  }

  if (isManagePath(pathname)) {
    if (!isLoggedIn) {
      return redirectWithPath(request, '/auth/sign-in');
    }

    const siteName = getSiteNameFromPath(pathname).trim().toLowerCase();

    if (!siteName) {
      return redirectWithPath(request, '/');
    }

    const staff = await fetchSessionRoute(request, '/api/session/staff', { siteName });

    if (staff.response.status === 401) {
      return redirectWithPath(request, '/auth/sign-in');
    }

    if (!staff.response.ok) {
      return redirectWithPath(request, `/${siteName}`);
    }

    return response;
  }

  if (isJoinPath(pathname)) {
    const siteName = getSiteNameFromPath(pathname).trim().toLowerCase();

    if (!siteName) {
      return redirectWithPath(request, '/');
    }

    if (!isLoggedIn) {
      return redirectWithPath(request, '/auth/sign-in');
    }

    const rhizomeState = await fetchRhizomeState(request, siteName);

    if (!rhizomeState.response.ok || !rhizomeState.result?.siteInfo) {
      return redirectWithPath(request, '/');
    }

    if (rhizomeState.result.siteInfo.site_type !== 'community') {
      return redirectWithPath(request, `/${siteName}`);
    }

    const member = await fetchSessionRoute(request, '/api/session/member', { siteName });

    if (member.response.status === 401) {
      return redirectWithPath(request, '/auth/sign-in');
    }

    if (member.response.ok) {
      return redirectWithPath(request, `/${siteName}`);
    }

    return response;
  }

  return response;
}
