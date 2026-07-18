// ─── KV Store Abstraction ───────────────────────────────────────────────────
// Provides persistent storage for discovered B20 tokens and scan state.
// Uses Upstash Redis (Vercel KV replacement) in production.
// Falls back to in-memory Map for local development when env vars are unset.

import { Redis } from "@upstash/redis";

// ─── Types ──────────────────────────────────────────────────────────────────
export interface CachedToken {
  address: string;
  name: string;
  symbol: string;
  variant: "asset" | "stablecoin";
  decimals: number;
  currency?: string;
  txHash: string;
  createdAt: number; // block timestamp
}

export interface ScanState {
  lastScannedBlock: number;
  tokens: CachedToken[];
}

// ─── KV Keys ────────────────────────────────────────────────────────────────
const KEYS = {
  LAST_SCANNED_BLOCK: "b20:scan:lastBlock",
  TOKENS: "b20:tokens",
} as const;

// ─── Redis client (lazy singleton) ──────────────────────────────────────────
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

// ─── In-memory fallback for local dev ───────────────────────────────────────
const memoryStore = new Map<string, unknown>();

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get the full scan state (last block + cached tokens).
 * Returns defaults if nothing is cached.
 */
export async function getScanState(): Promise<ScanState> {
  const kv = getRedis();

  if (kv) {
    try {
      const [lastBlock, tokens] = await Promise.all([
        kv.get<number>(KEYS.LAST_SCANNED_BLOCK),
        kv.get<CachedToken[]>(KEYS.TOKENS),
      ]);

      return {
        lastScannedBlock: lastBlock ?? 0,
        tokens: tokens ?? [],
      };
    } catch (err) {
      console.error("[kv-store] Redis read error, falling back to defaults:", err);
      return { lastScannedBlock: 0, tokens: [] };
    }
  }

  // In-memory fallback
  return {
    lastScannedBlock: (memoryStore.get(KEYS.LAST_SCANNED_BLOCK) as number) ?? 0,
    tokens: (memoryStore.get(KEYS.TOKENS) as CachedToken[]) ?? [],
  };
}

/**
 * Update the last scanned block position.
 */
export async function setLastScannedBlock(block: number): Promise<void> {
  const kv = getRedis();

  if (kv) {
    try {
      await kv.set(KEYS.LAST_SCANNED_BLOCK, block);
    } catch (err) {
      console.error("[kv-store] Redis write error (lastBlock):", err);
    }
    return;
  }

  memoryStore.set(KEYS.LAST_SCANNED_BLOCK, block);
}

/**
 * Add newly discovered tokens to the cache (merge, no duplicates).
 * Also updates the last scanned block atomically.
 */
export async function addCachedTokens(
  newTokens: CachedToken[],
  lastScannedBlock: number,
): Promise<void> {
  if (newTokens.length === 0) {
    // Only update the block position
    await setLastScannedBlock(lastScannedBlock);
    return;
  }

  const kv = getRedis();

  if (kv) {
    try {
      // Read existing tokens
      const existing = (await kv.get<CachedToken[]>(KEYS.TOKENS)) ?? [];
      const existingAddrs = new Set(existing.map((t) => t.address.toLowerCase()));

      // Merge new tokens (skip duplicates)
      const unique = newTokens.filter(
        (t) => !existingAddrs.has(t.address.toLowerCase()),
      );
      const merged = [...existing, ...unique];

      // Write both atomically via pipeline
      const pipeline = kv.pipeline();
      pipeline.set(KEYS.TOKENS, merged);
      pipeline.set(KEYS.LAST_SCANNED_BLOCK, lastScannedBlock);
      await pipeline.exec();
    } catch (err) {
      console.error("[kv-store] Redis write error (tokens):", err);
    }
    return;
  }

  // In-memory fallback
  const existing = (memoryStore.get(KEYS.TOKENS) as CachedToken[]) ?? [];
  const existingAddrs = new Set(existing.map((t) => t.address.toLowerCase()));
  const unique = newTokens.filter(
    (t) => !existingAddrs.has(t.address.toLowerCase()),
  );
  memoryStore.set(KEYS.TOKENS, [...existing, ...unique]);
  memoryStore.set(KEYS.LAST_SCANNED_BLOCK, lastScannedBlock);
}
