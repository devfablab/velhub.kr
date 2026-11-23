import { fetchApiRoute } from '@/lib/service/site/siteApiRoutes';

export async function getHubApiData<T>(
  path: string,
  fallback: string,
  init?: RequestInit,
): Promise<{ data: T | null; error: string }> {
  try {
    const response = await fetchApiRoute(path, init);
    const data = (await response.json()) as T & { error?: string };

    if (!response.ok) {
      throw new Error(data.error ?? fallback);
    }

    return { data, error: '' };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : fallback };
  }
}
