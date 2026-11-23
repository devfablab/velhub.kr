import { after } from 'next/server';
import { redis } from '@/lib/clients/redis';
import { getSupabaseAdmin } from '@/lib/clients/supabase';

export type PublicCacheTag = 'posts' | 'sites' | 'people' | 'link-previews' | `site:${string}`;

type PublicCacheEntry<T> = {
  versions: string;
  data: T;
};

type MemoryCacheEntry = {
  versions: string;
  data: unknown;
  expiresAt: number;
};

type ReadPublicCacheOptions<T> = {
  key: string;
  tags: PublicCacheTag[];
  ttlSeconds: number;
  load: () => Promise<T>;
  shouldStore?: (data: T) => boolean;
};

type ReadPublicResponseOptions = {
  key: string;
  tags: PublicCacheTag[];
  ttlSeconds: number;
  load: () => Promise<{ response: Response; isPublic: boolean }>;
};

type PublicResponseEntry = {
  status: number;
  body: unknown;
  isPublic: boolean;
};

const PUBLIC_CACHE_PREFIX = 'public-cache:';
const MEMORY_CACHE_MAX_ENTRIES = 1000;
const memoryCache = new Map<string, MemoryCacheEntry>();

async function getTagVersions(tags: PublicCacheTag[]) {
  const versionsResult = await getSupabaseAdmin()
    .from('public_cache_versions')
    .select('tag, version')
    .in('tag', tags);

  if (versionsResult.error) {
    throw versionsResult.error;
  }

  const versionMap = new Map((versionsResult.data ?? []).map((row) => [row.tag as string, String(row.version)]));

  return [...tags]
    .sort()
    .map((tag) => `${tag}=${versionMap.get(tag) ?? '0'}`)
    .join('|');
}

function readMemoryCache<T>(cacheKey: string, versions: string): T | undefined {
  const entry = memoryCache.get(cacheKey);

  if (!entry) {
    return undefined;
  }

  if (entry.versions !== versions || entry.expiresAt <= Date.now()) {
    memoryCache.delete(cacheKey);
    return undefined;
  }

  memoryCache.delete(cacheKey);
  memoryCache.set(cacheKey, entry);

  return structuredClone(entry.data) as T;
}

function writeMemoryCache(cacheKey: string, versions: string, data: unknown, ttlSeconds: number) {
  memoryCache.delete(cacheKey);
  memoryCache.set(cacheKey, { versions, data: structuredClone(data), expiresAt: Date.now() + ttlSeconds * 1000 });

  while (memoryCache.size > MEMORY_CACHE_MAX_ENTRIES) {
    const oldestKey = memoryCache.keys().next().value;

    if (oldestKey === undefined) {
      break;
    }

    memoryCache.delete(oldestKey);
  }
}

export async function readPublicCache<T>({
  key,
  tags,
  ttlSeconds,
  load,
  shouldStore,
}: ReadPublicCacheOptions<T>): Promise<T> {
  const cacheKey = `${PUBLIC_CACHE_PREFIX}${key}`;
  let versions: string;

  try {
    versions = await getTagVersions(tags);
  } catch (error) {
    console.error('[publicCache] version read error', key, error);
    return load();
  }

  const memoryData = readMemoryCache<T>(cacheKey, versions);

  if (memoryData !== undefined) {
    return memoryData;
  }

  try {
    const sharedEntry = await redis.get<PublicCacheEntry<T>>(cacheKey);

    if (sharedEntry && sharedEntry.versions === versions) {
      writeMemoryCache(cacheKey, versions, sharedEntry.data, ttlSeconds);
      return sharedEntry.data;
    }
  } catch (error) {
    console.error('[publicCache] shared read error', key, error);
  }

  const data = await load();

  if (shouldStore && !shouldStore(data)) {
    return data;
  }

  writeMemoryCache(cacheKey, versions, data, ttlSeconds);
  after(async () => {
    try {
      await redis.set(cacheKey, { versions, data }, { ex: ttlSeconds });
    } catch (error) {
      console.error('[publicCache] shared write error', key, error);
    }
  });

  return data;
}

export async function readPublicResponse({ key, tags, ttlSeconds, load }: ReadPublicResponseOptions) {
  const entry = await readPublicCache<PublicResponseEntry>({
    key,
    tags,
    ttlSeconds,
    load: async () => {
      const { response, isPublic } = await load();
      return { status: response.status, body: await response.json(), isPublic };
    },
    shouldStore: (result) => result.isPublic && result.status === 200,
  });

  return Response.json(entry.body, { status: entry.status });
}
