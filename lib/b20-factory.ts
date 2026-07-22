// lib/b20-factory.ts
// B20 Token Factory integration for Base Mainnet.
//
// The B20 factory is a precompile at 0xB20f000000000000000000000000000000000000
// that emits B20Created(address indexed token, uint8 indexed variant, string name,
// string symbol, uint8 decimals, bytes variantEventParams) for every token it
// creates. This module wraps discovery of those events.
//
// NOTE: the canonical, decoder-correct implementation lives in
// lib/b20-client.ts::discoverB20Tokens. This module re-exports a thin,
// metadata-aware wrapper so server routes can fetch tokens + timestamps in
// one call without a per-token metadata RPC storm (the event already carries
// name/symbol/decimals/variant).

import { getProvider, discoverB20Tokens, getBlockTimestamp } from "./b20-client";
import { cacheGet, cacheSet, TTL } from "./server-cache";
import type { B20Token } from "./types";

// Shape returned by discoverB20Tokens (matches the B20Created event payload).
export interface FactoryToken {
  address: string;
  blockNumber: number;
  txHash: string;
  variant: number;
  name: string;
  symbol: string;
  decimals: number;
}

/**
 * Discover B20 tokens created in the given block range by scanning the
 * factory's B20Created events. Returns token address + variant + name +
 * symbol + decimals straight from the event — no per-token RPC round-trips.
 *
 * This is a thin, typed re-export of lib/b20-client.ts::discoverB20Tokens.
 */
export async function getB20TokensFromFactory(
  limit: number = 1000,
  fromBlock: number = 0,
): Promise<FactoryToken[]> {
  const provider = getProvider();
  const currentBlock = await provider.getBlockNumber();
  const toBlock = fromBlock > 0 ? fromBlock + limit * 50 : currentBlock;

  // discoverB20Tokens scans [fromBlock, toBlock] for B20Created logs.
  const discovered = await discoverB20Tokens(
    Math.max(0, fromBlock),
    Math.min(toBlock, currentBlock),
  );

  // Most-recent first, capped to `limit`.
  return discovered
    .sort((a, b) => b.blockNumber - a.blockNumber)
    .slice(0, limit);
}

/**
 * Discover B20 tokens and resolve their creation timestamps. Returns full
 * B20Token objects (without marketData — that's layered on by the caller).
 *
 * Timestamps are fetched per unique block (cached), so a batch of 500 tokens
 * created across ~50 blocks only triggers ~50 cached getBlock calls, not 500.
 */
export async function getB20TokensWithMetadata(
  limit: number = 500,
  fromBlock: number = 0,
): Promise<B20Token[]> {
  const cacheKey = `b20:factory:meta:${limit}:${fromBlock}`;
  const cached = await cacheGet<B20Token[]>(cacheKey);
  if (cached) return cached;

  const discovered = await getB20TokensFromFactory(limit, fromBlock);

  // Resolve block timestamps (cached per block) without a per-token RPC storm.
  const blockTsCache = new Map<number, number>();
  const tokens: B20Token[] = [];
  for (const t of discovered) {
    let createdAt = 0;
    if (t.blockNumber > 0) {
      if (blockTsCache.has(t.blockNumber)) {
        createdAt = blockTsCache.get(t.blockNumber)!;
      } else {
        try {
          createdAt = await getBlockTimestamp(t.blockNumber);
          blockTsCache.set(t.blockNumber, createdAt);
        } catch {
          createdAt = 0;
        }
      }
    }

    tokens.push({
      address: t.address,
      name: t.name || "Unknown",
      symbol: t.symbol || "???",
      variant: t.variant === 1 ? "stablecoin" : "asset",
      decimals: t.decimals || 18,
      totalSupply: BigInt(0), // not carried by B20Created; fetch lazily if needed
      supplyCap: BigInt(0),
      creator: "", // not indexed in B20Created
      createdAt,
      txHash: t.txHash,
      isPaused: false,
    });
  }

  await cacheSet(cacheKey, tokens, TTL.DISCOVERY);
  return tokens;
}

/**
 * Fetch B20 tokens from third-party APIs (DexScreener, GeckoTerminal).
 *
 * NOTE: third-party DEX aggregators index tokens by their trading pools, and
 * B20 tokens (precompile-backed, 0xb200… addresses) are frequently NOT listed
 * on DEXes. The authoritative source is the factory's B20Created events, which
 * is what getB20TokensFromFactory uses. This function is kept as a best-effort
 * enrichment for tokens that DO have DEX liquidity.
 */
export async function fetchB20TokensFromThirdParty(
  _limit: number = 100,
): Promise<{ address: string; name: string; symbol: string; variant: "asset" | "stablecoin" }[]> {
  // Third-party discovery of B20 tokens by prefix is unreliable; the factory
  // is the source of truth. Return empty rather than surface misleading data.
  return [];
}
