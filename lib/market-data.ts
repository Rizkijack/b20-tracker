// lib/market-data.ts
// Unified multi-source market-data aggregator for B20 tokens on Base Mainnet.
// Sources: DexScreener, GeckoTerminal, Birdeye.so, CoinGecko, CoinMarketCap
//
// Design goals:
// • Server-only execution (API keys stay secret)
// • Aggressive in-memory LRU caching to avoid rate limits
// • Graceful degradation: if one source fails, the rest still contribute
// • Consistent return shape regardless of which sources are configured

import type { TokenMarketData, MarketDataSource } from "./types";
import { cacheGet, cacheSet, TTL } from "./server-cache";

const BASE_CHAIN_ID = 8453;
const BASE_CHAIN_SLUG = "base";

// ─── Persistent cross-instance cache (see lib/server-cache.ts) ──────────────
function _cacheKey(address: string): string {
  return `mkt:${address.toLowerCase()}`;
}

async function _fromCache(address: string): Promise<TokenMarketData | null> {
  return await cacheGet<TokenMarketData>(_cacheKey(address));
}

async function _toCache(address: string, data: TokenMarketData): Promise<void> {
  await cacheSet(_cacheKey(address), data, TTL.MARKET);
}

// ─── Helper: retry with exponential backoff ──────────────────────────────────
async function _fetchJson(
  url: string,
  opts?: RequestInit & { retries?: number; retryDelay?: number },
): Promise<unknown> {
  const { retries = 2, retryDelay = 800, ...fetchOpts } = opts ?? {};
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        ...fetchOpts,
        headers: {
          Accept: "application/json",
          ...(fetchOpts.headers || {}),
        },
      });
      if (!res.ok) {
        // Some 429s / 5xx should retry
        if ((res.status >= 500 || res.status === 429) && i < retries) {
          await _sleep(retryDelay * (i + 1));
          continue;
        }
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (i < retries) await _sleep(retryDelay * (i + 1));
    }
  }
  throw lastErr;
}

function _sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. DexScreener (free, no key)
// ═══════════════════════════════════════════════════════════════════════════════
// Endpoint: GET https://api.dexscreener.com/latest/dex/tokens/{tokenAddress}
// Returns: pairs[] across all chains; we filter for base & sort by liquidity.

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; symbol: string };
  quoteToken: { address: string; symbol: string };
  priceNative?: string;
  priceUsd?: string;
  txns?: {
    m5?: { buys: number; sells: number };
    h1?: { buys: number; sells: number };
    h6?: { buys: number; sells: number };
    h24?: { buys: number; sells: number };
  };
  volume?: { h24?: number; h6?: number; h1?: number; m5?: number };
  priceChange?: { h24?: number; h6?: number; h1?: number; m5?: number };
  liquidity?: { usd?: number; base?: number; quote?: number };
  fdv?: number;
  marketCap?: number;
}

async function _fetchDexScreener(
  address: string,
): Promise<Partial<TokenMarketData> | null> {
  try {
    const data = (await _fetchJson(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      { retries: 1 },
    )) as { pairs?: DexScreenerPair[] };

    if (!Array.isArray(data.pairs) || data.pairs.length === 0) return null;

    // Filter Base Mainnet pairs only
    const basePairs = data.pairs.filter(
      (p) => String(p.chainId).toLowerCase() === "base",
    );
    if (basePairs.length === 0) return null;

    // Pick the pair with highest liquidity
    const top = basePairs.sort(
      (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0),
    )[0];

    const txns24h = top.txns?.h24 ?? { buys: 0, sells: 0 };

    return {
      priceUsd: top.priceUsd ? parseFloat(top.priceUsd) : null,
      priceChange24h: top.priceChange?.h24 ?? null,
      marketCap: top.marketCap ?? null,
      fdv: top.fdv ?? null,
      volume24h: top.volume?.h24 ?? null,
      volumeChange24h: null, // DexScreener doesn't expose this directly
      liquidityUsd: top.liquidity?.usd ?? null,
      liquidityChange24h: null,
      topPairAddress: top.pairAddress ?? null,
      dexUrl: top.url ?? null,
      txns24h: { buys: txns24h.buys, sells: txns24h.sells },
      holders: null,
      sourcePriority: ["dexscreener"],
      lastUpdated: Date.now(),
    };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. GeckoTerminal (free, no key)
// ═══════════════════════════════════════════════════════════════════════════════
// Endpoint: GET https://api.geckoterminal.com/api/v2/networks/base/tokens/{address}
//           GET …/pools?page=1 (for liquidity/volume)

interface GeckoTerminalTokenAttributes {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  total_supply: string | null;
  price_usd: string | null;
  fdv_usd: string | null;
  total_reserve_in_usd: string | null;
  volume_usd: { h24?: string; h6?: string; h1?: string; m5?: string };
  market_cap_usd: string | null;
}

interface GeckoTerminalPool {
  attributes: {
    address: string;
    name: string;
    reserve_in_usd: string;
    volume_usd: { h24?: string };
    transactions: { h24: { buys: number; sells: number } };
  };
}

async function _fetchGeckoTerminal(
  address: string,
): Promise<Partial<TokenMarketData> | null> {
  try {
    const tokenRes = (await _fetchJson(
      `https://api.geckoterminal.com/api/v2/networks/${BASE_CHAIN_SLUG}/tokens/${address}`,
      { retries: 1 },
    )) as { data?: { attributes?: GeckoTerminalTokenAttributes } };

    const attr = tokenRes.data?.attributes;
    if (!attr) return null;

    // Also fetch top pool for extra liquidity / txn detail
    let poolTxns: { buys: number; sells: number } | null = null;
    let poolLiquidity: number | null = null;
    let poolAddr: string | null = null;
    try {
      const poolsRes = (await _fetchJson(
        `https://api.geckoterminal.com/api/v2/networks/${BASE_CHAIN_SLUG}/tokens/${address}/pools?page=1`,
        { retries: 1 },
      )) as { data?: GeckoTerminalPool[] };
      const pools = poolsRes.data ?? [];
      if (pools.length > 0) {
        const topPool = pools[0].attributes;
        poolLiquidity = topPool.reserve_in_usd ? parseFloat(topPool.reserve_in_usd) : null;
        poolTxns = topPool.transactions?.h24 ?? null;
        poolAddr = topPool.address ?? null;
      }
    } catch {
      // ignore pool fetch failure
    }

    const priceUsd = attr.price_usd ? parseFloat(attr.price_usd) : null;
    const volume24h = attr.volume_usd?.h24 ? parseFloat(attr.volume_usd.h24) : null;
    const mcap = attr.market_cap_usd ? parseFloat(attr.market_cap_usd) : null;
    const fdv = attr.fdv_usd ? parseFloat(attr.fdv_usd) : null;

    return {
      priceUsd,
      priceChange24h: null, // GeckoTerminal token endpoint doesn't give pct change
      marketCap: mcap,
      fdv,
      volume24h,
      volumeChange24h: null,
      liquidityUsd: poolLiquidity ?? (attr.total_reserve_in_usd ? parseFloat(attr.total_reserve_in_usd) : null),
      liquidityChange24h: null,
      topPairAddress: poolAddr,
      dexUrl: poolAddr
        ? `https://www.geckoterminal.com/${BASE_CHAIN_SLUG}/pools/${poolAddr}`
        : null,
      txns24h: poolTxns,
      holders: null,
      sourcePriority: ["geckoterminal"],
      lastUpdated: Date.now(),
    };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Birdeye.so (free tier API key required)
// ═══════════════════════════════════════════════════════════════════════════════
// Endpoint: GET https://public-api.birdeye.so/defi/v3/token/market-data?address=...
// Header: X-API-KEY

interface BirdeyeMarketData {
  data?: {
    address: string;
    price: number;
    priceChange24hPercent?: number;
    volume24hUSD?: number;
    marketCapUSD?: number;
    liquidityUSD?: number;
    uniqueWallet24h?: number;
  };
}

async function _fetchBirdeye(
  address: string,
): Promise<Partial<TokenMarketData> | null> {
  const apiKey = process.env.BIRDEYE_API_KEY;
  if (!apiKey) return null;

  try {
    const data = (await _fetchJson(
      `https://public-api.birdeye.so/defi/v3/token/market-data?address=${address}`,
      {
        headers: { "X-API-KEY": apiKey },
        retries: 1,
      },
    )) as BirdeyeMarketData;

    const d = data.data;
    if (!d) return null;

    return {
      priceUsd: d.price ?? null,
      priceChange24h: d.priceChange24hPercent ?? null,
      marketCap: d.marketCapUSD ?? null,
      fdv: null,
      volume24h: d.volume24hUSD ?? null,
      volumeChange24h: null,
      liquidityUsd: d.liquidityUSD ?? null,
      liquidityChange24h: null,
      topPairAddress: null,
      dexUrl: `https://birdeye.so/token/${address}?chain=base`,
      txns24h: null,
      holders: d.uniqueWallet24h ?? null,
      sourcePriority: ["birdeye"],
      lastUpdated: Date.now(),
    };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. CoinGecko (free tier, optional API key for higher rate limits)
// ═══════════════════════════════════════════════════════════════════════════════
// Endpoint: GET https://api.coingecko.com/api/v3/coins/base/contract/{address}
//   or with pro key: https://pro-api.coingecko.com/api/v3/coins/base/contract/{address}

interface CoinGeckoCoin {
  id?: string;
  market_data?: {
    current_price?: { usd?: number };
    price_change_percentage_24h?: number;
    market_cap?: { usd?: number };
    total_volume?: { usd?: number };
    fdv_to_tvl_ratio?: number;
    fully_diluted_valuation?: { usd?: number };
  };
  tickers?: Array<{
    trade_url?: string;
    market?: { name?: string };
    volume?: number;
  }>;
}

async function _fetchCoinGecko(
  address: string,
): Promise<Partial<TokenMarketData> | null> {
  const apiKey = process.env.COINGECKO_API_KEY;
  const baseUrl = apiKey
    ? "https://pro-api.coingecko.com/api/v3"
    : "https://api.coingecko.com/api/v3";

  try {
    const data = (await _fetchJson(
      `${baseUrl}/coins/${BASE_CHAIN_SLUG}/contract/${address}`,
      {
        headers: apiKey ? { "x-cg-pro-api-key": apiKey } : {},
        retries: 1,
      },
    )) as CoinGeckoCoin;

    const md = data.market_data;
    if (!md) return null;

    const price = md.current_price?.usd ?? null;
    const mcap = md.market_cap?.usd ?? null;
    const fdv = md.fully_diluted_valuation?.usd ?? null;
    const vol = md.total_volume?.usd ?? null;

    // Best ticker URL
    const bestTicker = (data.tickers ?? []).sort(
      (a, b) => (b.volume ?? 0) - (a.volume ?? 0),
    )[0];

    return {
      priceUsd: price,
      priceChange24h: md.price_change_percentage_24h ?? null,
      marketCap: mcap,
      fdv,
      volume24h: vol,
      volumeChange24h: null,
      liquidityUsd: null,
      liquidityChange24h: null,
      topPairAddress: null,
      dexUrl: bestTicker?.trade_url ?? null,
      txns24h: null,
      holders: null,
      sourcePriority: ["coingecko"],
      lastUpdated: Date.now(),
    };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. CoinMarketCap (free tier API key required)
// ═══════════════════════════════════════════════════════════════════════════════
// Endpoint: GET https://pro-api.coinmarketcap.com/v2/cryptocurrency/info?address=...&CMC_PRO_API_KEY=...
//   + quotes/latest for market data

interface CmcMapItem {
  id: number;
  symbol: string;
}
interface CmcQuote {
  price?: number;
  volume_24h?: number;
  volume_change_24h?: number;
  percent_change_24h?: number;
  market_cap?: number;
}

async function _fetchCoinMarketCap(
  address: string,
): Promise<Partial<TokenMarketData> | null> {
  const apiKey = process.env.COINMARKETCAP_API_KEY;
  if (!apiKey) return null;

  try {
    // Step 1: map address -> CMC id
    const mapRes = (await _fetchJson(
      `https://pro-api.coinmarketcap.com/v1/cryptocurrency/map?address=${address}`,
      {
        headers: { "X-CMC_PRO_API_KEY": apiKey },
        retries: 1,
      },
    )) as { data?: CmcMapItem[] };

    const id = mapRes.data?.[0]?.id;
    if (!id) return null;

    // Step 2: fetch latest quote
    const quoteRes = (await _fetchJson(
      `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?id=${id}`,
      {
        headers: { "X-CMC_PRO_API_KEY": apiKey },
        retries: 1,
      },
    )) as { data?: Record<string, { quote?: { USD?: CmcQuote } }> };

    const q = quoteRes.data?.[String(id)]?.quote?.USD;
    if (!q) return null;

    return {
      priceUsd: q.price ?? null,
      priceChange24h: q.percent_change_24h ?? null,
      marketCap: q.market_cap ?? null,
      fdv: null,
      volume24h: q.volume_24h ?? null,
      volumeChange24h: q.volume_change_24h ?? null,
      liquidityUsd: null,
      liquidityChange24h: null,
      topPairAddress: null,
      dexUrl: null,
      txns24h: null,
      holders: null,
      sourcePriority: ["coinmarketcap"],
      lastUpdated: Date.now(),
    };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mash-up engine: merge partial results into a single TokenMarketData
// ═══════════════════════════════════════════════════════════════════════════════

function _mergePartials(
  address: string,
  partials: (Partial<TokenMarketData> | null)[],
): TokenMarketData {
  const valid = partials.filter(Boolean) as Partial<TokenMarketData>[];

  const firstValue = <T>(getter: (p: Partial<TokenMarketData>) => T | null | undefined): T | null => {
    for (const p of valid) {
      const v = getter(p);
      if (v !== null && v !== undefined) return v;
    }
    return null;
  };

  const sumValue = (getter: (p: Partial<TokenMarketData>) => number | null | undefined): number | null => {
    let total = 0;
    let has = false;
    for (const p of valid) {
      const v = getter(p);
      if (typeof v === "number") {
        total += v;
        has = true;
      }
    }
    return has ? total : null;
  };

  const sources: MarketDataSource[] = [];
  for (const p of valid) {
    for (const s of p.sourcePriority ?? []) {
      if (!sources.includes(s)) sources.push(s);
    }
  }

  return {
    priceUsd: firstValue((p) => p.priceUsd),
    priceChange24h: firstValue((p) => p.priceChange24h),
    marketCap: firstValue((p) => p.marketCap) ?? firstValue((p) => p.fdv),
    fdv: firstValue((p) => p.fdv),
    volume24h: firstValue((p) => p.volume24h),
    volumeChange24h: firstValue((p) => p.volumeChange24h),
    liquidityUsd: firstValue((p) => p.liquidityUsd),
    liquidityChange24h: firstValue((p) => p.liquidityChange24h),
    topPairAddress: firstValue((p) => p.topPairAddress),
    dexUrl: firstValue((p) => p.dexUrl),
    txns24h: firstValue((p) => p.txns24h),
    holders: firstValue((p) => p.holders),
    sourcePriority: sources,
    lastUpdated: Date.now(),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface FetchMarketDataOptions {
  /** Override which sources to query. Default = all available. */
  sources?: MarketDataSource[];
  /** Skip cache and force fresh fetch. */
  skipCache?: boolean;
}

/**
 * Fetch aggregated market data for a single B20 token address.
 * Safe to call from server-side Next.js API routes or server components.
 */
export async function fetchTokenMarketData(
  address: string,
  opts?: FetchMarketDataOptions,
): Promise<TokenMarketData> {
  const normalized = address.toLowerCase();

  if (!opts?.skipCache) {
    const cached = await _fromCache(normalized);
    if (cached) return cached;
  }

  const requestedSources = opts?.sources ?? [
    "dexscreener",
    "geckoterminal",
    "birdeye",
    "coingecko",
    "coinmarketcap",
  ];

  const promises: Promise<Partial<TokenMarketData> | null>[] = [];

  if (requestedSources.includes("dexscreener"))
    promises.push(_fetchDexScreener(normalized));
  if (requestedSources.includes("geckoterminal"))
    promises.push(_fetchGeckoTerminal(normalized));
  if (requestedSources.includes("birdeye"))
    promises.push(_fetchBirdeye(normalized));
  if (requestedSources.includes("coingecko"))
    promises.push(_fetchCoinGecko(normalized));
  if (requestedSources.includes("coinmarketcap"))
    promises.push(_fetchCoinMarketCap(normalized));

  const partials = await Promise.all(promises);
  const merged = _mergePartials(normalized, partials);

  await _toCache(normalized, merged);
  return merged;
}

/**
 * Batch fetch market data for multiple token addresses.
 * Fires requests in parallel with a small concurrency limit to avoid raining.
 */
export async function batchFetchMarketData(
  addresses: string[],
  opts?: FetchMarketDataOptions,
  concurrency = 5,
): Promise<Map<string, TokenMarketData>> {
  const result = new Map<string, TokenMarketData>();

  const queue = [...addresses];
  async function worker() {
    while (queue.length > 0) {
      const addr = queue.shift()!;
      try {
        const data = await fetchTokenMarketData(addr, opts);
        result.set(addr.toLowerCase(), data);
      } catch {
        // silently skip failed tokens
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return result;
}
