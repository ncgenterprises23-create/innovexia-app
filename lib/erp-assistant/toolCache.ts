import { cache, generateCacheKey } from '@/lib/cache';

const ASSISTANT_TTL_MS = 90_000;

export async function cachedAssistantFetch<T>(
  prefix: string,
  params: Record<string, string | number | undefined>,
  fetcher: () => Promise<T>
): Promise<T> {
  const key = generateCacheKey(`assistant:${prefix}`, params);
  const hit = cache.get<T>(key);
  if (hit != null) return hit;
  const data = await fetcher();
  cache.set(key, data, ASSISTANT_TTL_MS);
  return data;
}
