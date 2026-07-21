// lib/server-cache.ts
// Persistent, cross-instance server cache for B20 Scanner.
//
// On serverless (Vercel) each cold instance starts with an empty in-memory
// Map. This module provides:
//   • a global-singleton Map fallback (survives warm reloads in a single
//     instance via globalThis)
//   • an optional Upstash Redis adapter (UPSTASH_REDIS_REST_URL +
//     UPSTASH_REDIS_REST_TOKEN) for true cross-instance persistence
//   • a TTL-based get/set API used by both the RPC client and the
//     market-data aggregator
//
// It is intentionally safe to import from anywhere: in the browser (or any
// non-server context) the external adapter is absent and the global singleton is
// empty, so calls degrade to a no-op cache without throwing.
// Only the SERVER code that calls cacheGet/cacheSet actually populates it
// (Route Handlers + server-side lib usage).
//
// Required env vars for external cache:
//   UPSTASH_REDIS_REST_URL  (or fallback REDIS_URL / UPSTASH_URL)
//   UPSTASH_REDIS_REST_TOKEN

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// ─── Adapter: optional external KV (Upstash REST API) ───────────
const UPSTASH_URL =
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.REDIS_URL ||
  process.env.UPSTASH_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function externalGet<T>(key: string): Promise<T | null> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN || typeof fetch === "undefined") return null;
  try {
    const res = await fetch(`${UPSTASH_URL}/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: string | null };
    if (json.result == null) return null;
    const entry = JSON.parse(json.result) as CacheEntry<T>;
    if (entry.expiresAt < Date.now()) return null;
    return entry.value;
  } catch {
    return null;
  }
}

async function externalSet<T>(key: string, value: T, ttlMs: number): Promise<void> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN || typeof fetch === "undefined") return;
  try {
    const entry: CacheEntry<T> = { value, expiresAt: Date.now() + ttlMs };
    const ttlSeconds = Math.ceil(ttlMs / 1000);
    await fetch(UPSTASH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
      },
      body: JSON.stringify([
        "SET",
        key,
        JSON.stringify(entry),
        "EX",
        ttlSeconds,
      ]),
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
