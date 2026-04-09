import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

type RequestCookieStore = NextRequest['cookies'];
type RequestCookieSetArguments = Parameters<RequestCookieStore['set']>;
type CookieOptions = RequestCookieSetArguments[2];

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

function isManagePath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);

  return segments.length >= 2 && segments[1] === 'manage';
}

function getSiteNameFromPath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);

  return segments[0] ?? '';
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
  const isLoggedIn = Boolean(claimsResult.data?.claims?.sub);

  if (
    (request.nextUrl.pathname.startsWith('/settings') || request.nextUrl.pathname.startsWith('/new')) &&
    !isLoggedIn
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/';
    redirectUrl.search = '';

    return NextResponse.redirect(redirectUrl);
  }

  if (isManagePath(request.nextUrl.pathname)) {
    if (!isLoggedIn) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/auth/sign-in';
      redirectUrl.search = '';

      return NextResponse.redirect(redirectUrl);
    }

    const siteName = getSiteNameFromPath(request.nextUrl.pathname).trim().toLowerCase();

    if (!siteName) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/';
      redirectUrl.search = '';

      return NextResponse.redirect(redirectUrl);
    }

    const manageCheckResponse = await fetch(new URL('/api/auth/manage', request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: request.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({
        siteName,
      }),
    });

    if (manageCheckResponse.status === 401) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/auth/sign-in';
      redirectUrl.search = '';

      return NextResponse.redirect(redirectUrl);
    }

    if (!manageCheckResponse.ok) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/${siteName}`;
      redirectUrl.search = '';

      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth/manage|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
