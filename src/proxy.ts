import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/session';

type CommunityManageRole =
  | 'owner'
  | 'community-manager'
  | 'board-manager'
  | 'board-general-manager'
  | 'board-assistant-manager';

type CommunityManageLevel = CommunityManageRole | 'member';

type SessionRouteResult = {
  ok: boolean;
  allow?: boolean;
  redirectTo?: string | null;
  role?: string | null;
  siteType?: string | null;
  communityRoles?: CommunityManageRole[];
  siteRole?: string | null;
  invite?: boolean;
  inviteHref?: string | null;
};

type RhizomeStateResult = {
  siteInfo?: {
    visibility_type?: string | null;
    is_shutdown?: boolean | null;
    is_blocked?: boolean | null;
    site_type?: string | null;
  };
};

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

function isInvitePath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);

  return segments.length >= 3 && (segments[1] === 'invite-blog' || segments[1] === 'invite-community');
}

function isInviteOnlyPath(pathname: string, siteName: string) {
  return pathname === `/${siteName}/invite-only`;
}

function isSiteStatusPath(pathname: string, siteName: string) {
  return (
    pathname === `/${siteName}/unpaid` || pathname === `/${siteName}/closed` || pathname === `/${siteName}/suspended`
  );
}

function isMemberStatusPath(pathname: string, siteName: string) {
  return pathname === `/${siteName}/block` || pathname === `/${siteName}/ban` || pathname === `/${siteName}/kick`;
}

function startsWithAny(pathname: string, paths: string[]) {
  return paths.some((path) => pathname.startsWith(path));
}

function isCommunityManagerRestrictedPath(pathname: string, siteName: string) {
  const segments = pathname.split('/').filter(Boolean);

  const isBlogPostManagePath = pathname.startsWith(`/${siteName}/manage/contents/posts/`) && segments[4] !== 'c';

  return (
    isBlogPostManagePath ||
    startsWithAny(pathname, [
      `/${siteName}/manage/team`,
      `/${siteName}/manage/design/blog`,
      `/${siteName}/manage/invite-blog`,
    ])
  );
}

function isBlogManagerRestrictedPath(pathname: string, siteName: string) {
  return startsWithAny(pathname, [
    `/${siteName}/manage/join`,
    `/${siteName}/manage/members`,
    `/${siteName}/manage/design/community`,
    `/${siteName}/manage/contents/posts/c`,
  ]);
}

function isCommunityBoardRoleRestrictedPath(pathname: string, siteName: string) {
  return startsWithAny(pathname, [
    `/${siteName}/manage/settings`,
    `/${siteName}/manage/join`,
    `/${siteName}/manage/members`,
    `/${siteName}/manage/reports`,
    `/${siteName}/manage/design`,
    `/${siteName}/manage/payments`,
    `/${siteName}/manage/stats`,
  ]);
}

function isCommunityGeneralRoleRestrictedPath(pathname: string, siteName: string) {
  return pathname.startsWith(`/${siteName}/manage/contents/posts/c/new`);
}

function isCommunityAssistantRoleRestrictedPath(pathname: string, siteName: string) {
  const segments = pathname.split('/').filter(Boolean);

  const isBoardEditPath =
    pathname.startsWith(`/${siteName}/manage/contents/posts/c/`) && Boolean(segments[5]) && segments[6] === 'edit';

  return (
    isBoardEditPath ||
    startsWithAny(pathname, [
      `/${siteName}/manage/contents/posts/c/only-donation/series`,
      `/${siteName}/manage/contents/posts/c/only-donation/prefix`,
    ])
  );
}

function isBlogMemberRestrictedPath(pathname: string, siteName: string) {
  const segments = pathname.split('/').filter(Boolean);

  const isPageEditPath =
    pathname.startsWith(`/${siteName}/manage/contents/pages/`) && Boolean(segments[4]) && segments[5] === 'edit';

  return (
    isPageEditPath ||
    startsWithAny(pathname, [
      `/${siteName}/manage/design`,
      `/${siteName}/manage/invite-blog`,
      `/${siteName}/manage/join`,
      `/${siteName}/manage/members`,
      `/${siteName}/manage/payments`,
      `/${siteName}/manage/reports`,
      `/${siteName}/manage/settings`,
      `/${siteName}/manage/stats`,
      `/${siteName}/manage/team`,
      `/${siteName}/manage/contents/pages/new`,
      `/${siteName}/manage/contents/posts/c`,
      `/${siteName}/manage/contents/posts/series`,
      `/${siteName}/manage/contents/posts/category`,
    ])
  );
}

function getCommunityManageLevel(
  baseRole: string | null | undefined,
  communityRoles: CommunityManageRole[],
): CommunityManageLevel {
  if (baseRole === 'owner' || communityRoles.includes('owner')) {
    return 'owner';
  }

  if (communityRoles.includes('community-manager')) {
    return 'community-manager';
  }

  if (communityRoles.includes('board-manager')) {
    return 'board-manager';
  }

  if (communityRoles.includes('board-general-manager')) {
    return 'board-general-manager';
  }

  if (communityRoles.includes('board-assistant-manager')) {
    return 'board-assistant-manager';
  }

  return 'member';
}

function getManageRedirectPath({
  pathname,
  siteName,
  siteType,
  baseRole,
  communityRoles,
}: {
  pathname: string;
  siteName: string;
  siteType: string | null | undefined;
  baseRole: string | null | undefined;
  communityRoles: CommunityManageRole[];
}) {
  if (baseRole === 'admin') {
    return null;
  }

  if (siteType === 'blog') {
    if ((baseRole === 'owner' || baseRole === 'manager') && isBlogManagerRestrictedPath(pathname, siteName)) {
      return `/${siteName}/manage`;
    }

    if (baseRole === 'member' && isBlogMemberRestrictedPath(pathname, siteName)) {
      return `/${siteName}`;
    }

    if (baseRole !== 'owner' && baseRole !== 'manager' && baseRole !== 'member') {
      return `/${siteName}`;
    }

    return null;
  }

  if (siteType === 'community') {
    const manageLevel = getCommunityManageLevel(baseRole, communityRoles);

    if (
      (manageLevel === 'owner' || manageLevel === 'community-manager') &&
      isCommunityManagerRestrictedPath(pathname, siteName)
    ) {
      return `/${siteName}/manage`;
    }

    if (
      (manageLevel === 'board-manager' ||
        manageLevel === 'board-general-manager' ||
        manageLevel === 'board-assistant-manager') &&
      isCommunityBoardRoleRestrictedPath(pathname, siteName)
    ) {
      return `/${siteName}/manage`;
    }

    if (
      (manageLevel === 'board-general-manager' || manageLevel === 'board-assistant-manager') &&
      isCommunityGeneralRoleRestrictedPath(pathname, siteName)
    ) {
      return `/${siteName}/manage`;
    }

    if (manageLevel === 'board-assistant-manager' && isCommunityAssistantRoleRestrictedPath(pathname, siteName)) {
      return `/${siteName}/manage`;
    }

    if (manageLevel === 'member') {
      return `/${siteName}`;
    }

    return null;
  }

  return `/${siteName}`;
}

async function fetchSessionRoute(request: NextRequest, pathname: string, query: Record<string, string>) {
  const targetUrl = new URL(pathname, request.url);

  Object.entries(query).forEach(([key, value]) => {
    targetUrl.searchParams.set(key, value);
  });

  const routeResponse = await fetch(targetUrl, {
    method: 'GET',
    headers: {
      cookie: request.headers.get('cookie') ?? '',
    },
  });

  let result: SessionRouteResult | null = null;

  try {
    result = (await routeResponse.json()) as SessionRouteResult;
  } catch {
    result = null;
  }

  return {
    response: routeResponse,
    result,
  };
}

async function fetchRhizomeState(request: NextRequest, siteName: string) {
  const targetUrl = new URL('/api/site/public', request.url);

  targetUrl.searchParams.set('siteName', siteName);

  const routeResponse = await fetch(targetUrl, {
    method: 'GET',
    headers: {
      cookie: request.headers.get('cookie') ?? '',
    },
  });

  let result: RhizomeStateResult | null = null;

  try {
    result = (await routeResponse.json()) as RhizomeStateResult;
  } catch {
    result = null;
  }

  return {
    response: routeResponse,
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
      return new NextResponse(
        JSON.stringify({
          error: '2FA verification required',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    return response;
  }

  if (pathname.startsWith('/settings') || pathname.startsWith('/new') || pathname.startsWith('/hub')) {
    if (!isLoggedIn) {
      return redirectWithPath(request, '/auth/sign-in');
    }

    return response;
  }

  if (isSitePath(pathname) && !isInvitePath(pathname)) {
    const siteName = getSiteNameFromPath(pathname).trim().toLowerCase();

    if (siteName) {
      const rhizomeState = await fetchRhizomeState(request, siteName);

      if (rhizomeState.response.ok && rhizomeState.result?.siteInfo) {
        if (
          rhizomeState.result.siteInfo.visibility_type === 'private' &&
          !isSiteStatusPath(pathname, siteName) &&
          !isMemberStatusPath(pathname, siteName)
        ) {
          if (isInviteOnlyPath(pathname, siteName)) {
            return response;
          }

          if (!isLoggedIn) {
            return redirectWithPath(request, `/${siteName}/invite-only`);
          }

          const member = await fetchSessionRoute(request, '/api/session/member', {
            siteName,
          });

          if (member.response.ok && member.result?.ok) {
            return response;
          }

          const header = await fetchSessionRoute(request, '/api/header/site', {
            siteName,
          });

          const inviteHref = header.result?.inviteHref ?? null;

          if (header.response.ok && header.result?.invite && inviteHref) {
            return redirectWithPath(request, inviteHref);
          }

          return redirectWithPath(request, `/${siteName}/invite-only`);
        }

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
      const isMemberStatus = isMemberStatusPath(pathname, siteName);

      if (isLoggedIn) {
        const member = await fetchSessionRoute(request, '/api/session/member', {
          siteName,
        });

        const memberRedirectTo = member.result?.redirectTo ?? null;

        if (
          memberRedirectTo === `/${siteName}/block` ||
          memberRedirectTo === `/${siteName}/ban` ||
          memberRedirectTo === `/${siteName}/kick`
        ) {
          if (pathname !== memberRedirectTo) {
            return redirectWithPath(request, memberRedirectTo);
          }

          return response;
        }

        if (isMemberStatus) {
          return redirectWithPath(request, `/${siteName}`);
        }
      } else if (isMemberStatus) {
        return redirectWithPath(request, '/auth/sign-in');
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

    const member = await fetchSessionRoute(request, '/api/session/member', { siteName });

    if (member.response.status === 401) {
      return redirectWithPath(request, '/auth/sign-in');
    }

    if (!member.response.ok || !member.result?.ok) {
      return redirectWithPath(request, `/${siteName}`);
    }

    const redirectPath = getManageRedirectPath({
      pathname,
      siteName,
      siteType: member.result.siteType,
      baseRole: member.result.role,
      communityRoles: member.result.communityRoles ?? [],
    });

    if (redirectPath && pathname !== redirectPath) {
      return redirectWithPath(request, redirectPath);
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
