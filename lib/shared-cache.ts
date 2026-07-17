// Shared cache layer using Vercel KV / Upstash Redis with in-memory fallback
// Automatically uses KV when UPSTASH_REDIS_REST_URL is set, otherwise falls back to memory

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// ─── In-Memory Store (fallback) ────────────────────────────────────────────
const memStore = new Map<string, CacheEntry<unknown>>();

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memStore) {
      if (entry.expiresAt < now) memStore.delete(key);
    }
  }, 60_000);
}

// ─── Upstash Redis Client (lazy init) ──────────────────────────────────────
let redisClient: { get: (key: string) => Promise<string | null>; set: (key: string, value: string, opts: { px: number }) => Promise<unknown> } | null = null;

function getRedis() {
  if (redisClient) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) {
    const baseUrl = url.replace(/\/$/, "");
    redisClient = {
      async get(key: string): Promise<string | null> {
        const res = await fetch(`${baseUrl}/get/${encodeURIComponent(key)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return null;
        const json = await res.json();
        return json.result ?? null;
      },
      async set(key: string, value: string, opts: { px: number }): Promise<unknown> {
        const res = await fetch(`${baseUrl}/set/${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(value),
        });
        if (!res.ok) return null;

        // Also set expiry via EXPIRE
        if (opts.px > 0) {
          await fetch(`${baseUrl}/pexpire/${encodeURIComponent(key)}/${opts.px}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
        return res.json();
      },
    };
    return redisClient;
  }
  return null;
}

function isSharedAvailable(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL);
}

// ─── Public API ────────────────────────────────────────────────────────────

export async function sharedCacheGet<T>(key: string): Promise<T | null> {
  // Try in-memory first (fast path)
  const memEntry = memStore.get(key) as CacheEntry<T> | undefined;
  if (memEntry && memEntry.expiresAt > Date.now()) {
    return memEntry.data;
  }
  if (memEntry) memStore.delete(key);

  // Try shared KV
  const client = getRedis();
  if (client) {
    try {
      const raw = await client.get(`b20:${key}`);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { data: T; expiresAt: number };
          // Also populate in-memory for fast subsequent access
          memStore.set(key, { data: parsed.data, expiresAt: parsed.expiresAt });
          if (parsed.expiresAt > Date.now()) return parsed.data;
        } catch {
          // corrupt data, ignore
        }
      }
    } catch {
      // Redis unavailable, fall through
    }
  }

  return null;
}

export async function sharedCacheSet<T>(key: string, data: T, ttlMs: number): Promise<void> {
  const expiresAt = Date.now() + ttlMs;

  // Always store in memory
  memStore.set(key, { data, expiresAt });

  // Also store in shared KV if available
  const client = getRedis();
  if (client) {
    try {
      const payload = JSON.stringify({ data, expiresAt });
      await client.set(`b20:${key}`, payload, { px: ttlMs });
    } catch {
      // silently fail
    }
  }
}

export function cacheKey(...parts: (string | number)[]): string {
  return parts.join(":");
}

// TTL constants (milliseconds)
export const TTL = {
  BLOCK_NUMBER: 2_000,      // 2 seconds
  BLOCK_TIMESTAMP: 60_000,  // 1 minute (immutable)
  TOKEN_METADATA: 30_000,   // 30 seconds
  TOKEN_DISCOVERY: 10_000,  // 10 seconds
  TOKEN_EVENTS: 2_000,      // 2 seconds
  FACTORY_EVENTS: 10_000,   // 10 seconds
  TOKEN_DETAIL_PAGE: 30_000, // 30 seconds (ISR-aligned)
};

export { isSharedAvailable };
