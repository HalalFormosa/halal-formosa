import { notifyFetchError } from '@/utils/offlineFeedback';

// Global state for caching (persists across navigations within the session)
const cache: Record<string, { data: any, timestamp: number }> = {};
const DEFAULT_TTL = 1000 * 60 * 5; // 5 minutes

export function useHomeData() {

  async function withCache(key: string, fetcher: () => Promise<any>, ttl = DEFAULT_TTL) {
    const now = Date.now();
    const cachedItem = cache[key];

    if (cachedItem && (now - cachedItem.timestamp < ttl)) {
      console.log(`[HomeCache] Using cached data for: ${key}`);
      return cachedItem.data;
    }

    console.log(`[HomeCache] Fetching fresh data for: ${key}`);
    try {
      const data = await fetcher();
      cache[key] = { data, timestamp: now };
      return data;
    } catch (err) {
      // Offline / failed fetch — fall back to whatever was last loaded (even if
      // stale) instead of leaving the section stuck spinning or throwing up
      // through every caller's un-caught `withCache(...)` call.
      console.warn(`[HomeCache] Fetch failed for "${key}", falling back to cache:`, err);
      notifyFetchError(err as any);
      return cachedItem?.data ?? null;
    }
  }

  function clearCache(key?: string) {
    if (key) {
      delete cache[key];
    } else {
      Object.keys(cache).forEach(k => delete cache[k]);
    }
  }

  return { withCache, clearCache };
}
