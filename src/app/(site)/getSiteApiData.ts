import { cookies, headers } from 'next/headers';

export async function getSiteApiData<T>(path: string, fallback: string): Promise<{ data: T | null; error: string; status: number }> {
  try {
    const cookieStore = await cookies();
    const headerList = await headers();
    const host = headerList.get('host');
    const protocol = headerList.get('x-forwarded-proto') || 'http';
    const response = await fetch(`${protocol}://${host}${path}`, {
      headers: { cookie: cookieStore.toString() },
      cache: 'no-store',
    });
    const data = (await response.json()) as T & { error?: string };

    if (!response.ok) {
      return { data: data as T, error: data.error ?? fallback, status: response.status };
    }

    return { data, error: '', status: response.status };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : fallback, status: 500 };
  }
}
