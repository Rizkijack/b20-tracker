// lib/b20-discovery.ts
// Real-time B20 token discovery + market-data enrichment for Base Mainnet.
//
// Two-layer strategy (the only reliable way to surface B20 tokens WITH
// real-time price/volume/liquidity):
//
//   Layer 1 — Discovery (on-chain, authoritative):
//     Scan B20Created events emitted by the B20 factory precompile
//     (0xB20f…0000). The event carries the token address (indexed, in
//     topics[1]), variant, name, symbol & decimals — no per-token metadata
//     RPC round-trips. This is the complete set of B20 tokens.
//
//   Layer 2 — Market enrichment (DEX aggregators, real-time):
//     B20Created does NOT carry price/liquidity/volume. We batch the
//     discovered addresses through DexScreener and GeckoTerminal (both free,
//     no key) which index Base DEX pools. Only B20 tokens that have actual
//     trading liquidity appear here — most fresh B20 tokens have none, so
//     market data is an overlay, not a filter.
//
// All RPC log ranges are chunked to ≤10,000 blocks: the public Base RPC
// (mainnet.base.org) rejects eth_getLogs ranges above 10k with
// "-32614 eth_getLogs is limited to a 10,000 range". This was the root cause
// of the empty/500 responses from the previous implementation.

import { JsonRpcProvider, Contract, id, AbiCoder } from "ethers";
import { cacheGet, cacheSet, TTL } from "./server-cache";
import {
  cacheGetSync,
  cacheSetSync,
  cacheKey,
  TTL as RpcTTL,
} from "./rpc-cache";
import {
  B20_FACTORY_ADDRESS,
  B20_ADDRESS_PREFIX,
  BASE_RPC_URLS,
} from "./constants";
import type { TokenMarketData } from "./types";

// ─── Provider (server-side singleton) ────────────────────────────────────────
const providers: JsonRpcProvider[] = BASE_RPC_URLS.map(
  (url) => new JsonRpcProvider(url, 8453),
);

let providerCursor = 0;
function nextProvider(): JsonRpcProvider {
  const p = providers[providerCursor % providers.length];
  providerCursor = (providerCursor + 1) % providers.length;
  return p;
}

export async function rpcCall<T>(fn: (p: JsonRpcProvider) => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < providers.length * 2; attempt++) {
    const p = nextProvider();
    try {
      return await fn(p);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

// Public Base RPC caps eth_getLogs at 10,000 blocks per call. Stay safely under
// that to avoid "-32614 eth_getLogs is limited to a 10,000 range".
const SAFE_LOG_RANGE = 5_000;

// ─── Types ──────────────────────────────────────────────────────────────────
export interface DiscoveredB20Token {
  address: string;
  blockNumber: number;
  txHash: string;
  variant: number; // 0 = asset, 1 = stablecoin
  name: string;
  symbol: string;
  decimals: number;
}

export interface B20TokenWithMarket extends DiscoveredB20Token {
  marketData?: TokenMarketData;
  hasLiquidity: boolean;
}

export type B20DataSource = "factory" | "dex" | "mixed";

// ═══════════════════════════════════════════════════════════════════════════════
// Layer 1: Discover B20 tokens from factory B20Created events
// ═══════════════════════════════════════════════════════════════════════════════
// Canonical event per base-std IB20Factory.sol:
//   event B20Created(address indexed token, uint8 indexed variant, string name,
//                    string symbol, uint8 decimals, bytes variantEventParams);
const B20_CREATED_TOPIC = id(
  "B20Created(address,uint8,string,string,uint8,bytes)",
);

function isB20Address(address: string): boolean {
  const a = address.toLowerCase();
  return a.startsWith("0xb200") || a.startsWith("0xb201");
}

function detectVariant(address: string): "asset" | "stablecoin" {
  const cleaned = address.toLowerCase().replace("0x", "");
  if (cleaned.length < 40) return "asset";
  // variant byte sits at hex positions [20:22] (byte 10)
  return parseInt(cleaned.slice(20, 22), 16) === 1 ? "stablecoin" : "asset";
}

/**
 * Discover B20 tokens created within [fromBlock, toBlock] by scanning the
 * factory's B20Created events. Ranges are chunked to SAFE_LOG_RANGE to respect
 * the public Base RPC's 10k-block eth_getLogs limit.
 *
 * Results are returned most-recent-first.
 */
export async function discoverB20TokensFromFactory(
  fromBlock: number,
  toBlock: number,
): Promise<DiscoveredB20Token[]> {
  const cacheK = `b20:discover:${fromBlock}:${toBlock}`;
  const cached = await cacheGet<DiscoveredB20Token[]>(cacheK);
  if (cached) return cached;

  if (toBlock < fromBlock) return [];

  const tokens: DiscoveredB20Token[] = [];
  const seen = new Set<string>();
  const coder = new AbiCoder();

  // Scan newest-first so the result array is already most-recent-first.
  for (let end = toBlock; end >= fromBlock; end -= SAFE_LOG_RANGE) {
    const start = Math.max(fromBlock, end - SAFE_LOG_RANGE + 1);
    try {
      const logs = await rpcCall((p) =>
        p.getLogs({
          fromBlock: start,
          toBlock: end,
          address: B20_FACTORY_ADDRESS,
          topics: [B20_CREATED_TOPIC],
        }),
      );

      for (const log of logs) {
        if (!log.topics || log.topics.length < 3) continue;
        // topics[1] = indexed token address (padded to 32 bytes)
        const tokenAddress = "0x" + log.topics[1].slice(26).toLowerCase();
        if (seen.has(tokenAddress)) continue;
        if (!isB20Address(tokenAddress)) continue;
        seen.add(tokenAddress);

        const variant = parseInt(log.topics[2], 16) || 0;
        let name = "Unknown";
        let symbol = "???";
        let decimals = 18;
        try {
          const dataHex = log.data.startsWith("0x") ? log.data : "0x" + log.data;
          const decoded = coder.decode(
            ["string", "string", "uint8", "bytes"],
            dataHex,
          );
          name = decoded[0] || "Unknown";
          symbol = decoded[1] || "???";
          decimals = Number(decoded[2]) || 18;
        } catch {
          // fall back to defaults if decode fails
        }

        tokens.push({
          address: tokenAddress,
          blockNumber: Number(log.blockNumber),
          txHash: log.transactionHash ?? "",
          variant,
          name,
          symbol,
          decimals,
        });
      }
    } catch (err) {
      console.error(`discoverB20: logs ${start}-${end} failed:`, err);
    }
  }

  await cacheSet(cacheK, tokens, TTL.DISCOVERY);
  return tokens;
}

/**
 * Get the current Base mainnet block number, with provider rotation + retry
 * and a short cache so a flood of concurrent requests coalesces into one RPC
 * call. This is the single, safe entry point for block-height reads — every
 * other module should call this (or /api/block/current) rather than hitting
 * the RPC directly.
 *
 * Uses the sync in-memory cache shared with /api/block/current so that server
 * code and API routes share the same cached value instead of each hitting the
 * RPC independently.
 */
export async function getCurrentBlockNumber(): Promise<number> {
  // Must match /api/block/current so both paths share the same in-memory entry.
  const cacheK = cacheKey("block", "current");
  const cached = cacheGetSync<number>(cacheK);
  if (cached !== undefined) return cached;

  const blockNumber = await rpcCall((p) => p.getBlockNumber());
  // Share the same 2s TTL + key as /api/block/current so server code and the
  // API route coalesce into a single RPC call under load.
  cacheSetSync(cacheK, blockNumber, RpcTTL.BLOCK_NUMBER);
  return blockNumber;
}

/**
 * Discover the most recent B20 tokens by scanning the last `blockWindow`
 * blocks (default ~50k ≈ 1.2 days). Caps the scan at MAX_SCAN_BLOCKS so a
 * misconfigured window can't trigger thousands of sequential RPC calls.
 */
const MAX_SCAN_BLOCKS = 100_000;

export async function discoverRecentB20Tokens(
  blockWindow = 50_000,
): Promise<{ tokens: DiscoveredB20Token[]; currentBlock: number; source: B20DataSource }> {
  const currentBlock = await getCurrentBlockNumber();
  const window = Math.min(Math.max(blockWindow, 1), MAX_SCAN_BLOCKS);
  const fromBlock = Math.max(0, currentBlock - window);
  const tokens = await discoverB20TokensFromFactory(fromBlock, currentBlock);
  return { tokens, currentBlock, source: "factory" };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Layer 2: Market enrichment via DEX aggregators (DexScreener + GeckoTerminal)
// ═══════════════════════════════════════════════════════════════════════════════
// Both are free, require no API key, and index Base Mainnet DEX pools.
// Per https://docs.base.org/get-started/data-indexers these are the recommended
// Base data indexers for token market data. We filter strictly to Base and to
// B20-prefixed (0xb200/0xb201) token addresses so only real B20 tokens surface.

const BASE_CHAIN_ID = 8453;
const DEXSCREENER_CHAIN = "base";
const GECKO_CHAIN_SLUG = "base";

async function _fetchJson(url: string, opts?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...opts,
    headers: { Accept: "application/json", ...(opts?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// ─── DexScreener ─────────────────────────────────────────────────────────────
// GET /latest/dex/tokens/{addr1,addr2,...addr30}  (up to 30 addresses per call)
interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  priceChange?: { h24?: number; h6?: number; h1?: number; m5?: number };
  volume?: { h24?: number; h6?: number; h1?: number; m5?: number };
  liquidity?: { usd?: number; base?: number; quote?: number };
  fdv?: number;
  marketCap?: number;
  txns?: {
    m5?: { buys: number; sells: number };
    h1?: { buys: number; sells: number };
    h6?: { buys: number; sells: number };
    h24?: { buys: number; sells: number };
  };
  pairCreatedAt?: number;
}

/**
 * Fetch market data for up to 30 B20 token addresses via DexScreener's batch
 * endpoint. Returns a Map keyed by lowercased token address. Only Base-chain
 * pairs whose baseToken is B20-prefixed are kept.
 */
export async function fetchDexScreenerBatch(
  addresses: string[],
): Promise<Map<string, TokenMarketData>> {
  const out = new Map<string, TokenMarketData>();
  if (addresses.length === 0) return out;

  const joined = addresses.slice(0, 30).join(",");
  try {
    const data = (await _fetchJson(
      `https://api.dexscreener.com/latest/dex/tokens/${joined}`,
    )) as { pairs?: DexScreenerPair[] };

    if (!Array.isArray(data.pairs)) return out;

    for (const pair of data.pairs) {
      // Strict Base + B20 filtering
      if (String(pair.chainId).toLowerCase() !== DEXSCREENER_CHAIN) continue;
      const baseAddr = pair.baseToken.address.toLowerCase();
      if (!isB20Address(baseAddr)) continue;

      // Keep the most-liquid pair per token
      const liq = pair.liquidity?.usd ?? 0;
      const existing = out.get(baseAddr);
      if (existing && (existing.liquidityUsd ?? 0) >= liq) continue;

      const txns24h = pair.txns?.h24 ?? { buys: 0, sells: 0 };

      out.set(baseAddr, {
        priceUsd: pair.priceUsd ? parseFloat(pair.priceUsd) : null,
        priceChange24h: pair.priceChange?.h24 ?? null,
        marketCap: pair.marketCap ?? null,
        fdv: pair.fdv ?? null,
        volume24h: pair.volume?.h24 ?? null,
        volumeChange24h: null,
        liquidityUsd: pair.liquidity?.usd ?? null,
        liquidityChange24h: null,
        topPairAddress: pair.pairAddress ?? null,
        dexUrl: pair.url ?? null,
        txns24h: { buys: txns24h.buys ?? 0, sells: txns24h.sells ?? 0 },
        holders: null,
        sourcePriority: ["dexscreener"],
        lastUpdated: Date.now(),
      });
    }
  } catch (err) {
    console.error("DexScreener batch failed:", err);
  }
  return out;
}

// ─── GeckoTerminal ───────────────────────────────────────────────────────────
// GET /v2/networks/base/tokens/{addr} (single) — used as a per-token fallback
// for tokens DexScreener doesn't index yet.
interface GeckoTokenData {
  data?: {
    id?: string;
    type?: string;
    attributes?: {
      address?: string;
      name?: string;
      symbol?: string;
      decimals?: number;
      total_supply?: string | null;
      price_usd?: string | null;
      fdv_usd?: string | null;
      market_cap_usd?: string | null;
      total_reserve_in_usd?: string | null;
      volume_usd?: { h24?: string };
    };
  };
}

/**
 * Fetch market data for a single B20 token via GeckoTerminal. Returns null when
 * the token has no indexed pool. Used to supplement DexScreener (GeckoTerminal
// sometimes indexes different/newer pools).
 */
export async function fetchGeckoTerminal(
  address: string,
): Promise<TokenMarketData | null> {
  const addr = address.toLowerCase();
  if (!isB20Address(addr)) return null;

  try {
    const data = (await _fetchJson(
      `https://api.geckoterminal.com/api/v2/networks/${GECKO_CHAIN_SLUG}/tokens/${addr}`,
    )) as GeckoTokenData;

    const attr = data.data?.attributes;
    if (!attr) return null;

    const priceUsd = attr.price_usd ? parseFloat(attr.price_usd) : null;
    const volume24h = attr.volume_usd?.h24 ? parseFloat(attr.volume_usd.h24) : null;
    const mcap = attr.market_cap_usd ? parseFloat(attr.market_cap_usd) : null;
    const fdv = attr.fdv_usd ? parseFloat(attr.fdv_usd) : null;
    const liq = attr.total_reserve_in_usd
      ? parseFloat(attr.total_reserve_in_usd)
      : null;

    // No price & no liquidity & no volume → token not actually traded
    if (priceUsd === null && volume24h === null && liq === null && mcap === null) {
      return null;
    }

    return {
      priceUsd,
      priceChange24h: null,
      marketCap: mcap,
      fdv,
      volume24h,
      volumeChange24h: null,
      liquidityUsd: liq,
      liquidityChange24h: null,
      topPairAddress: null,
      dexUrl: `https://www.geckoterminal.com/${GECKO_CHAIN_SLUG}/tokens/${addr}`,
      txns24h: null,
      holders: null,
      sourcePriority: ["geckoterminal"],
      lastUpdated: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Merge a GeckoTerminal result into an existing DexScreener entry, filling any
 * null fields GeckoTerminal provides. Mirrors the merge strategy in market-data.ts.
 */
function mergeGeckoInto(
  base: TokenMarketData,
  geo: TokenMarketData,
): TokenMarketData {
  const pick = <T>(a: T | null, b: T | null): T | null => (a !== null ? a : b);
  return {
    priceUsd: pick(base.priceUsd, geo.priceUsd),
    priceChange24h: pick(base.priceChange24h, geo.priceChange24h),
    marketCap: pick(base.marketCap, geo.marketCap),
    fdv: pick(base.fdv, geo.fdv),
    volume24h: pick(base.volume24h, geo.volume24h),
    volumeChange24h: pick(base.volumeChange24h, geo.volumeChange24h),
    liquidityUsd: pick(base.liquidityUsd, geo.liquidityUsd),
    liquidityChange24h: pick(base.liquidityChange24h, geo.liquidityChange24h),
    topPairAddress: pick(base.topPairAddress, geo.topPairAddress),
    dexUrl: pick(base.dexUrl, geo.dexUrl),
    txns24h: pick(base.txns24h, geo.txns24h),
    holders: pick(base.holders, geo.holders),
    sourcePriority: base.sourcePriority.includes("geckoterminal")
      ? base.sourcePriority
      : [...base.sourcePriority, "geckoterminal"],
    lastUpdated: Date.now(),
  };
}

/**
 * Enrich a list of discovered B20 tokens with real-time market data from
 * DexScreener (batched) + GeckoTerminal (per-token fallback for any gaps).
 *
 * DexScreener is queried first in batches of 30 (its documented max). Any
 * token DexScreener didn't return is optionally retried against GeckoTerminal
 * (concurrency-limited to avoid rate limits).
 */
export async function enrichB20TokensWithMarket(
  tokens: DiscoveredB20Token[],
  opts: { geckoFallback?: boolean } = {},
): Promise<B20TokenWithMarket[]> {
  const geckoFallback = opts.geckoFallback ?? true;
  const addresses = tokens.map((t) => t.address);

  // Batch DexScreener in groups of 30.
  const dexMap = new Map<string, TokenMarketData>();
  for (let i = 0; i < addresses.length; i += 30) {
    const batch = addresses.slice(i, i + 30);
    const m = await fetchDexScreenerBatch(batch);
    for (const [k, v] of m) dexMap.set(k, v);
  }

  // GeckoTerminal fallback for tokens DexScreener didn't cover.
  if (geckoFallback) {
    const missing = tokens.filter((t) => !dexMap.has(t.address.toLowerCase()));
    const geckoQueue = missing.slice(0, 30); // cap to keep latency bounded
    const concurrency = 5;
    let idx = 0;
    async function worker() {
      while (idx < geckoQueue.length) {
        const t = geckoQueue[idx++];
        const geo = await fetchGeckoTerminal(t.address);
        if (geo) dexMap.set(t.address.toLowerCase(), geo);
      }
    }
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
  }

  // Merge + annotate
  return tokens.map((t) => {
    const md = dexMap.get(t.address.toLowerCase());
    return {
      ...t,
      marketData: md,
      hasLiquidity: !!md && (md.liquidityUsd !== null || md.priceUsd !== null),
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Top-level: discover recent B20 tokens + enrich with market data
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Discover the most recent B20 tokens and enrich them with real-time market
 * data (DexScreener + GeckoTerminal). This is the single entry point used by
 * the dashboard.
 *
 * Returns tokens most-recent-first. Tokens without DEX liquidity still appear
 * (with hasLiquidity=false and no marketData) — they are real B20 tokens, just
 * not yet traded.
 */
export async function getRecentB20TokensWithMarket(
  blockWindow = 50_000,
  limit = 100,
): Promise<{
  tokens: B20TokenWithMarket[];
  currentBlock: number;
  source: B20DataSource;
}> {
  const cacheK = `b20:recent:${blockWindow}:${limit}`;
  const cached = await cacheGet<{
    tokens: B20TokenWithMarket[];
    currentBlock: number;
    source: B20DataSource;
  }>(cacheK);
  if (cached) return cached;

  const { tokens, currentBlock, source } = await discoverRecentB20Tokens(blockWindow);
  // Sort most-recent-first, then cap before enrichment to bound DEX calls.
  const recent = tokens
    .sort((a, b) => b.blockNumber - a.blockNumber)
    .slice(0, Math.min(limit, 150));

  const enriched = await enrichB20TokensWithMarket(recent);

  const result = { tokens: enriched, currentBlock, source };
  // Shorter TTL for market freshness; discovery itself is cached separately.
  await cacheSet(cacheK, result, TTL.MARKET);
  return result;
}
