// Simple in-memory cache with TTL for server-side RPC responses
// Works within a single server instance (dev, single-VM deploy)

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

const CLEANUP_INTERVAL = 60_000; // clean expired entries every 60s

// Periodic cleanup
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.expiresAt < now) store.delete(key);
    }
  }, CLEANUP_INTERVAL);
}

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.data;
}

export function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function cacheKey(...parts: (string | number)[]): string {
  return parts.join(":");
}

// TTL constants (in milliseconds)
export const TTL = {
  BLOCK_NUMBER: 2_000,      // 2 seconds
  BLOCK_TIMESTAMP: 60_000,  // 1 minute (immutable)
  TOKEN_METADATA: 30_000,   // 30 seconds (rarely changes)
  TOKEN_DISCOVERY: 10_000,  // 10 seconds
  TOKEN_EVENTS: 2_000,      // 2 seconds (near real-time)
};
