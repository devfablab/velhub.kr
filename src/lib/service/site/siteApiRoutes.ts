import { headers } from 'next/headers';
import { NextRequest } from 'next/server';
import { getSupabaseAuthHealth, isSupabaseAuthOutage } from '@/lib/auth/health.server';
import { getSessionClaims } from '@/lib/session/server';

type RouteHandler = (request: NextRequest, context: { params: Promise<never> }) => Promise<Response> | Response;

type SiteApiRoute = {
  pattern: string;
  load: () => Promise<unknown>;
};

const SITE_API_ROUTES: SiteApiRoute[] = [
  {
    pattern: '/api/manage/team/members/invite/[token]',
    load: () => import('@/app/api/manage/team/members/invite/[token]/route'),
  },
  {
    pattern: '/api/manage/contents/blog-posts/[contentId]/ad',
    load: () => import('@/app/api/manage/contents/blog-posts/[contentId]/ad/route'),
  },
  {
    pattern: '/api/site/[siteName]/community-on-blog/[postId]/comments',
    load: () => import('@/app/api/site/[siteName]/community-on-blog/[postId]/comments/route'),
  },
  {
    pattern: '/api/manage/contents/blog-posts/status',
    load: () => import('@/app/api/manage/contents/blog-posts/status/route'),
  },
  { pattern: '/api/manage/contents/pages/status', load: () => import('@/app/api/manage/contents/pages/status/route') },
  { pattern: '/api/manage/design/blog/comments', load: () => import('@/app/api/manage/design/blog/comments/route') },
  { pattern: '/api/manage/design/blog/fonts', load: () => import('@/app/api/manage/design/blog/fonts/route') },
  { pattern: '/api/manage/design/blog/links', load: () => import('@/app/api/manage/design/blog/links/route') },
  { pattern: '/api/manage/design/community/home', load: () => import('@/app/api/manage/design/community/home/route') },
  {
    pattern: '/api/manage/design/community/links',
    load: () => import('@/app/api/manage/design/community/links/route'),
  },
  { pattern: '/api/manage/design/shared/menu', load: () => import('@/app/api/manage/design/shared/menu/route') },
  {
    pattern: '/api/manage/payments/subscriptions/series',
    load: () => import('@/app/api/manage/payments/subscriptions/series/route'),
  },
  {
    pattern: '/api/manage/payments/subscriptions/site',
    load: () => import('@/app/api/manage/payments/subscriptions/site/route'),
  },
  { pattern: '/api/manage/team/members/invite', load: () => import('@/app/api/manage/team/members/invite/route') },
  {
    pattern: '/api/payments/portone/donation/post/success',
    load: () => import('@/app/api/payments/portone/donation/post/success/route'),
  },
  {
    pattern: '/api/payments/portone/donation/success',
    load: () => import('@/app/api/payments/portone/donation/success/route'),
  },
  {
    pattern: '/api/payments/portone/purchase/success',
    load: () => import('@/app/api/payments/portone/purchase/success/route'),
  },
  {
    pattern: '/api/payments/portone/subscriptions/success',
    load: () => import('@/app/api/payments/portone/subscriptions/success/route'),
  },
  {
    pattern: '/api/payments/portone/fail',
    load: () => import('@/app/api/payments/portone/fail/route'),
  },
  {
    pattern: '/api/payments/portone/donation/status',
    load: () => import('@/app/api/payments/portone/donation/status/route'),
  },
  {
    pattern: '/api/payments/portone/subscriptions/status',
    load: () => import('@/app/api/payments/portone/subscriptions/status/route'),
  },
  {
    pattern: '/api/info/advanced/site/[siteName]',
    load: () => import('@/app/api/info/advanced/site/[siteName]/route'),
  },
  { pattern: '/api/info/general/site/[siteName]', load: () => import('@/app/api/info/general/site/[siteName]/route') },
  { pattern: '/api/manage/join/invite/[token]', load: () => import('@/app/api/manage/join/invite/[token]/route') },
  {
    pattern: '/api/site/blog/[siteName]/favorites',
    load: () => import('@/app/api/site/blog/[siteName]/favorites/route'),
  },
  {
    pattern: '/api/site/[siteName]/community-on-blog/[postId]',
    load: () => import('@/app/api/site/[siteName]/community-on-blog/[postId]/route'),
  },
  {
    pattern: '/api/boards/[boardName]/[contentId]/comments',
    load: () => import('@/app/api/boards/[boardName]/[contentId]/comments/route'),
  },
  {
    pattern: '/api/boards/[boardName]/[contentId]/count',
    load: () => import('@/app/api/boards/[boardName]/[contentId]/count/route'),
  },
  {
    pattern: '/api/boards/[boardName]/[contentId]/poll',
    load: () => import('@/app/api/boards/[boardName]/[contentId]/poll/route'),
  },
  {
    pattern: '/api/boards/[boardName]/[contentId]/read',
    load: () => import('@/app/api/boards/[boardName]/[contentId]/read/route'),
  },
  { pattern: '/api/identity/portone/status', load: () => import('@/app/api/identity/portone/status/route') },
  { pattern: '/api/manage/join/approved', load: () => import('@/app/api/manage/join/approved/route') },
  { pattern: '/api/manage/join/banned', load: () => import('@/app/api/manage/join/banned/route') },
  { pattern: '/api/manage/join/conditions', load: () => import('@/app/api/manage/join/conditions/route') },
  { pattern: '/api/manage/join/invite', load: () => import('@/app/api/manage/join/invite/route') },
  { pattern: '/api/manage/join/managers', load: () => import('@/app/api/manage/join/managers/route') },
  { pattern: '/api/manage/members/blocked', load: () => import('@/app/api/manage/members/blocked/route') },
  { pattern: '/api/manage/members/levels', load: () => import('@/app/api/manage/members/levels/route') },
  { pattern: '/api/manage/members/withdrawn', load: () => import('@/app/api/manage/members/withdrawn/route') },
  { pattern: '/api/manage/payments/donation', load: () => import('@/app/api/manage/payments/donation/route') },
  { pattern: '/api/manage/stats/dashboard', load: () => import('@/app/api/manage/stats/dashboard/route') },
  { pattern: '/api/manage/stats/hot-post', load: () => import('@/app/api/manage/stats/hot-post/route') },
  { pattern: '/api/manage/stats/inactive', load: () => import('@/app/api/manage/stats/inactive/route') },
  { pattern: '/api/manage/stats/join', load: () => import('@/app/api/manage/stats/join/route') },
  { pattern: '/api/manage/stats/repeat-visit', load: () => import('@/app/api/manage/stats/repeat-visit/route') },
  { pattern: '/api/manage/team/members', load: () => import('@/app/api/manage/team/members/route') },
  { pattern: '/api/boards/[boardName]/category', load: () => import('@/app/api/boards/[boardName]/category/route') },
  { pattern: '/api/boards/[boardName]/prefix', load: () => import('@/app/api/boards/[boardName]/prefix/route') },
  { pattern: '/api/boards/[boardName]/series', load: () => import('@/app/api/boards/[boardName]/series/route') },
  {
    pattern: '/api/site/[siteName]/community-on-blog',
    load: () => import('@/app/api/site/[siteName]/community-on-blog/route'),
  },
  { pattern: '/api/site/[siteName]/notice', load: () => import('@/app/api/site/[siteName]/notice/route') },
  {
    pattern: '/api/boards/[boardName]/[contentId]',
    load: () => import('@/app/api/boards/[boardName]/[contentId]/route'),
  },
  { pattern: '/api/users/[siteName]/[userId]', load: () => import('@/app/api/users/[siteName]/[userId]/route') },
  { pattern: '/api/boards/all', load: () => import('@/app/api/boards/all/route') },
  { pattern: '/api/boards/write', load: () => import('@/app/api/boards/write/route') },
  { pattern: '/api/co-posts/by-post', load: () => import('@/app/api/co-posts/by-post/route') },
  { pattern: '/api/header/site', load: () => import('@/app/api/header/site/route') },
  { pattern: '/api/manage/blog-ads', load: () => import('@/app/api/manage/blog-ads/route') },
  { pattern: '/api/manage/denywords', load: () => import('@/app/api/manage/denywords/route') },
  { pattern: '/api/manage/guidelines', load: () => import('@/app/api/manage/guidelines/route') },
  { pattern: '/api/manage/notice', load: () => import('@/app/api/manage/notice/route') },
  { pattern: '/api/manage/recommended-posts', load: () => import('@/app/api/manage/recommended-posts/route') },
  { pattern: '/api/manage/reports', load: () => import('@/app/api/manage/reports/route') },
  { pattern: '/api/notifications/unread-count', load: () => import('@/app/api/notifications/unread-count/route') },
  { pattern: '/api/private-board/manage', load: () => import('@/app/api/private-board/manage/route') },
  { pattern: '/api/revenue/completed', load: () => import('@/app/api/revenue/completed/route') },
  { pattern: '/api/revenue/confirmed', load: () => import('@/app/api/revenue/confirmed/route') },
  { pattern: '/api/revenue/refunds', load: () => import('@/app/api/revenue/refunds/route') },
  { pattern: '/api/revenue/scheduled', load: () => import('@/app/api/revenue/scheduled/route') },
  { pattern: '/api/revenue/summary', load: () => import('@/app/api/revenue/summary/route') },
  { pattern: '/api/revenue/transactions', load: () => import('@/app/api/revenue/transactions/route') },
  { pattern: '/api/site/community', load: () => import('@/app/api/site/community/route') },
  { pattern: '/api/site/owner-transfer', load: () => import('@/app/api/site/owner-transfer/route') },
  { pattern: '/api/site/public', load: () => import('@/app/api/site/public/route') },
  { pattern: '/api/boards/[boardName]', load: () => import('@/app/api/boards/[boardName]/route') },
  { pattern: '/api/private-board/[postId]', load: () => import('@/app/api/private-board/[postId]/route') },
  { pattern: '/api/users/[siteName]', load: () => import('@/app/api/users/[siteName]/route') },
  { pattern: '/api/boards', load: () => import('@/app/api/boards/route') },
  { pattern: '/api/co-posts', load: () => import('@/app/api/co-posts/route') },
  { pattern: '/api/link-preview', load: () => import('@/app/api/link-preview/route') },
  { pattern: '/api/manage', load: () => import('@/app/api/manage/route') },
  { pattern: '/api/private-board', load: () => import('@/app/api/private-board/route') },
  { pattern: '/api/settlement', load: () => import('@/app/api/settlement/route') },
];

function matchRoute(pattern: string, pathname: string) {
  const patternSegments = pattern.split('/').filter(Boolean);
  const pathSegments = pathname.split('/').filter(Boolean);

  if (patternSegments.length !== pathSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index];
    const pathSegment = pathSegments[index];

    if (patternSegment.startsWith('[') && patternSegment.endsWith(']')) {
      params[patternSegment.slice(1, -1)] = decodeURIComponent(pathSegment);
      continue;
    }

    if (patternSegment !== pathSegment) {
      return null;
    }
  }

  return params;
}

async function getBlockedResponse(method: string) {
  const isReadRequest = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';

  if (!isReadRequest && isSupabaseAuthOutage(await getSupabaseAuthHealth())) {
    return Response.json({ error: '현재 인증 서버 장애로 읽기만 가능합니다.' }, { status: 503 });
  }

  const sessionClaims = await getSessionClaims();

  if (sessionClaims?.userId && sessionClaims.authenticationLevel === 'aal1' && sessionClaims.hasTotp === true) {
    return Response.json({ error: '2FA verification required' }, { status: 403 });
  }

  return null;
}

export async function callSiteApiRoute(path: string, init?: RequestInit): Promise<Response | null> {
  const pathname = new URL(path, 'http://localhost').pathname;

  for (const route of SITE_API_ROUTES) {
    const params = matchRoute(route.pattern, pathname);

    if (!params) {
      continue;
    }

    const method = (init?.method ?? 'GET').toUpperCase();
    const handler = ((await route.load()) as Record<string, unknown>)[method];

    if (typeof handler !== 'function') {
      return null;
    }

    const blockedResponse = await getBlockedResponse(method);

    if (blockedResponse) {
      return blockedResponse;
    }

    const headerList = await headers();
    const host = headerList.get('host') || 'localhost';
    const protocol = headerList.get('x-forwarded-proto') || 'http';
    const requestHeaders = new Headers(headerList);

    requestHeaders.delete('content-length');
    new Headers(init?.headers).forEach((value, key) => {
      requestHeaders.set(key, value);
    });

    const request = new NextRequest(`${protocol}://${host}${path}`, {
      method,
      headers: requestHeaders,
      body: method === 'GET' || method === 'HEAD' ? undefined : (init?.body ?? undefined),
    });

    return (handler as RouteHandler)(request, { params: Promise.resolve(params) as Promise<never> });
  }

  return null;
}
