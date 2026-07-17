// RPC Cache — dual layer: shared (KV/Redis) + in-memory
// In serverless environments, shared KV enables cache sharing across functions.
// In single-instance dev, falls back to in-memory transparently.

import {
  sharedCacheGet,
  sharedCacheSet,
  cacheKey as sharedCacheKey,
  TTL as SharedTTL,
} from "./shared-cache";

// Re-export the consistent API
export const cacheKey = sharedCacheKey;
export const TTL = SharedTTL;

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const result = await sharedCacheGet<T>(key);
  return result ?? undefined;
}

export function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  // Fire-and-forget — never block the request
  sharedCacheSet(key, data, ttlMs).catch(() => {});
}

// Synchronous in-memory-only fallback for hot-path reads
// (sharedCacheGet already populates this, so hot reads are instant)

// Local in-memory store for sync hot-path reads
interface LocalEntry<T> {
  data: T;
  expiresAt: number;
}

const localStore = new Map<string, LocalEntry<unknown>>();

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of localStore) {
      if (entry.expiresAt < now) localStore.delete(key);
    }
  }, 60_000);
}

export function cacheGetSync<T>(key: string): T | undefined {
  const entry = localStore.get(key) as LocalEntry<T> | undefined;
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    localStore.delete(key);
    return undefined;
  }
  return entry.data;
}

export function cacheSetSync<T>(key: string, data: T, ttlMs: number): void {
  localStore.set(key, { data, expiresAt: Date.now() + ttlMs } as LocalEntry<unknown>);
}
