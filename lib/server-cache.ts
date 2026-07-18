// lib/server-cache.ts
// Persistent, cross-instance server cache for B20 Scanner.
//
// On serverless (Vercel) each cold instance starts with an empty in-memory
// Map. This module provides:
//   • a global-singleton Map fallback (survives warm reloads in a single
//     instance via globalThis)
//   • an optional Redis-compatible adapter hook (REDIS_URL / UPSTASH_URL) for true
//     cross-instance persistence
//   • a TTL-based get/set API used by both the RPC client (#4) and the
//     market-data aggregator (#6)
//
// It is intentionally safe to import from anywhere: in the browser (or any
// non-server context) the external adapter is absent and the global singleton is
// empty, so calls degrade to a no-op cache without throwing.
// Only the SERVER code that calls cacheGet/cacheSet actually populates it
// (Route Handlers + server-side lib usage).

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// ─── Adapter: optional external KV (set REDIS_URL / UPSTASH_URL) ───────────
// We keep the interface tiny so it can be wired to Upstash/ioredis later
// without touching callers. When no external store is configured we fall back
// to the global singleton.
const EXTERNAL_URL = process.env.REDIS_URL || process.env.UPSTASH_URL;

async function externalGet<T>(key: string): Promise<T | null> {
  if (!EXTERNAL_URL || typeof fetch === "undefined") return null;
  try {
    const res = await fetch(`${EXTERNAL_URL}/get/${encodeURIComponent(key)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: string };
    if (json.result == null) return null;
    const entry = JSON.parse(json.result) as CacheEntry<T>;
    if (entry.expiresAt < Date.now()) return null;
    return entry.value;
  } catch {
    return null;
  }
}

async function externalSet<T>(key: string, value: T, ttlMs: number): Promise<void> {
  if (!EXTERNAL_URL || typeof fetch === "undefined") return;
  try {
    const entry: CacheEntry<T> = { value, expiresAt: Date.now() + ttlMs };
    await fetch(`${EXTERNAL_URL}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: JSON.stringify(entry), ttlSeconds: Math.ceil(ttlMs / 1000) }),
      cache: "no-store",
    });
  } catch {
    // best-effort; local cache still holds the value
  }
}

// ─── Local global singleton (survives HMR / warm instances) ───────────────────
const g = globalThis as unknown as {
  __b20Cache?: Map<string, CacheEntry<unknown>>;
};
const localStore: Map<string, CacheEntry<unknown>> =
  g.__b20Cache ?? (g.__b20Cache = new Map());

export async function cacheGet<T>(key: string): Promise<T | null> {
  // external store wins for cross-instance freshness
  const ext = await externalGet<T>(key);
  if (ext !== null) return ext;

  const entry = localStore.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    localStore.delete(key);
    return null;
  }
  return entry.value;
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlMs: number,
): Promise<void> {
  localStore.set(key, { value, expiresAt: Date.now() + ttlMs });
  await externalSet(key, value, ttlMs);
}

export function cacheDelete(key: string): void {
  localStore.delete(key);
}

export function cacheClear(): void {
  localStore.clear();
}

// TTL presets (ms)
export const TTL = {
  BLOCK: 4_000, // block number refreshes fast
  TOKEN_METADATA: 60_000, // on-chain metadata is slow-moving
  MARKET: 30_000, // market overlay per market-data.ts
  DISCOVERY: 120_000, // discovered-token set
} as const;
