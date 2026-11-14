import { cookies, headers } from 'next/headers';
import { callSiteApiRoute } from './siteApiRoutes';

async function readRouteResponse<T>(
  response: Response,
  fallback: string,
): Promise<{ data: T | null; error: string; status: number }> {
  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    return { data: data as T, error: data.error ?? fallback, status: response.status };
  }

  return { data, error: '', status: response.status };
}

export async function getSiteApiData<T>(
  path: string,
  fallback: string,
  init?: RequestInit,
): Promise<{ data: T | null; error: string; status: number }> {
  try {
    const routeResponse = await callSiteApiRoute(path, init);

    if (routeResponse) {
      return await readRouteResponse<T>(routeResponse, fallback);
    }

    const cookieStore = await cookies();
    const headerList = await headers();
    const host = headerList.get('host');
    const protocol = headerList.get('x-forwarded-proto') || 'http';
    const requestHeaders = new Headers(init?.headers);
    requestHeaders.set('cookie', cookieStore.toString());
    const response = await fetch(`${protocol}://${host}${path}`, {
      ...init,
      headers: requestHeaders,
      cache: 'no-store',
    });

    return await readRouteResponse<T>(response, fallback);
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : fallback, status: 500 };
  }
}
