"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { B20Token, TokenMarketData } from "@/lib/types";
import {
  discoverB20Tokens,
  fetchTokenMetadata,
  detectVariant,
  getCurrentBlockNumber,
  getBlockTimestamp,
} from "@/lib/b20-client";
import { POLLING_INTERVAL, MAX_TOKEN_DISCOVERY_BATCH } from "@/lib/constants";

// Estimate B20 activation block (~June 26, 2025)
// Base blocks: ~2s per block. June 26, 2025 ≈ block ~25,000,000
const B20_ACTIVATION_BLOCK = 25000000;

// Persist the last-scanned block in localStorage so a cold start resumes from
// where it left off instead of re-scanning from B20_ACTIVATION_BLOCK.
const SCAN_CURSOR_KEY = "b20:lastScannedBlock";

// New: Data source configuration
const DATA_SOURCE = {
  FACTORY: "factory",      // Direct from B20 Factory contract
  THIRD_PARTY: "thirdparty", // From DexScreener/GeckoTerminal
  BLOCK_SCAN: "blockscan",  // Traditional block-by-block scanning (fallback)
} as const;

type DataSource = (typeof DATA_SOURCE)[keyof typeof DATA_SOURCE];

// Priority order for data sources
const DATA_SOURCE_PRIORITY: DataSource[] = [
  DATA_SOURCE.FACTORY,
  DATA_SOURCE.THIRD_PARTY,
  DATA_SOURCE.BLOCK_SCAN,
];

function loadScanCursor(): number {
  if (typeof window === "undefined") return B20_ACTIVATION_BLOCK;
  const raw = window.localStorage.getItem(SCAN_CURSOR_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : B20_ACTIVATION_BLOCK;
}

function saveScanCursor(block: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SCAN_CURSOR_KEY, String(block));
}

// Market data refresh cadence (ms) + how many tokens get live market overlays
const MARKET_REFRESH_MS = 30_000;
const MARKET_OVERLAY_LIMIT = 20;

/**
 * Fetch market data for a slice of token addresses via the server-side
 * batch API route. API keys (Birdeye/CMC) never touch the browser.
 */
async function fetchMarketOverlay(
  addresses: string[],
): Promise<Map<string, TokenMarketData>> {
  const out = new Map<string, TokenMarketData>();
  if (addresses.length === 0) return out;
  try {
    const res = await fetch(
      `/api/market/batch?addresses=${addresses.join(",")}`,
      { cache: "no-store" },
    );
    if (!res.ok) return out;
    const json = (await res.json()) as Record<string, TokenMarketData>;
    for (const [addr, data] of Object.entries(json)) {
      out.set(addr.toLowerCase(), data);
    }
  } catch {
    // Market overlay is best-effort; on-chain data is the base layer.
  }
  return out;
}

/**
 * Fetch tokens from factory API (most efficient method)
 */
async function fetchTokensFromFactory(
  limit: number = 500
): Promise<B20Token[]> {
  try {
    const res = await fetch(
      `/api/factory-tokens?limit=${limit}&metadata=true`,
      { cache: "no-store" },
    );
    
    if (!res.ok) {
      console.warn("Factory API failed, falling back to other sources");
      return [];
    }
    
    const data = await res.json();
    return data.map((token: any) => ({
      address: token.address,
      name: token.name || "Unknown",
      symbol: token.symbol || "???",
      variant: token.variant || "asset",
      decimals: token.decimals || 18,
      currency: token.currency,
      totalSupply: BigInt(token.totalSupply || 0),
      supplyCap: BigInt(0),
      creator: token.creator || "",
      createdAt: token.createdAt || 0,
      txHash: token.txHash || "",
      isPaused: token.isPaused || false,
    })) as B20Token[];
  } catch (error) {
    console.error("Error fetching from factory API:", error);
    return [];
  }
}

/**
 * Fetch tokens from third-party APIs (DexScreener, GeckoTerminal)
 */
async function fetchTokensFromThirdParty(
  limit: number = 100
): Promise<Partial<B20Token>[]> {
  try {
    const res = await fetch(
      `/api/thirdparty-tokens?limit=${limit}`,
      { cache: "no-store" },
    );
    
    if (!res.ok) {
      console.warn("Third-party API failed");
      return [];
    }
    
    const data = await res.json();
    return data.map((token: any) => ({
      address: token.address,
      name: token.name || "Unknown",
      symbol: token.symbol || "???",
      variant: token.variant || "asset",
    })) as Partial<B20Token>[];
  } catch (error) {
    console.error("Error fetching from third-party API:", error);
    return [];
  }
}

/**
 * Enrich token data with metadata and market data
 */
async function enrichTokenData(
  token: Partial<B20Token>,
  discoveredRef: React.MutableRefObject<Set<string>>
): Promise<B20Token | null> {
  const addrLower = token.address?.toLowerCase();
  if (!addrLower || discoveredRef.current.has(addrLower)) {
    return null;
  }
  
  discoveredRef.current.add(addrLower);
  
  try {
    // Get metadata from chain
    const meta = await fetchTokenMetadata(token.address!);
    const timestamp = token.createdAt || await getBlockTimestamp(0);
    const variant = token.variant || detectVariant(token.address!);
    
    const enriched: B20Token = {
      address: token.address!,
      name: meta.name || token.name || "Unknown",
      symbol: meta.symbol || token.symbol || "???",
      variant: variant,
      decimals: meta.decimals || 18,
      currency: meta.currency,
      totalSupply: meta.totalSupply || BigInt(0),
      supplyCap: BigInt(0),
      creator: token.creator || "",
      createdAt: timestamp,
      txHash: token.txHash || "",
      isPaused: token.isPaused || false,
    };
    
    return enriched;
  } catch (error) {
    console.error(`Error enriching token ${token.address}:`, error);
    return null;
  }
}

/**
 * Try to discover tokens using multiple sources in priority order
 */
async function discoverTokensWithFallback(
  discoveredRef: React.MutableRefObject<Set<string>>,
  limit: number = 500
): Promise<B20Token[]> {
  const allTokens: B20Token[] = [];
  
  // Try each data source in priority order
  for (const source of DATA_SOURCE_PRIORITY) {
    if (allTokens.length >= limit) break;
    
    try {
      let tokens: Partial<B20Token>[] = [];
      
      switch (source) {
        case DATA_SOURCE.FACTORY:
          tokens = await fetchTokensFromFactory(limit);
          break;
          
        case DATA_SOURCE.THIRD_PARTY:
          tokens = await fetchTokensFromThirdParty(limit);
          break;
          
        case DATA_SOURCE.BLOCK_SCAN:
          // Fallback to traditional block scanning
          const latestBlock = await getCurrentBlockNumber();
          const lastScannedBlock = loadScanCursor();
          const blocksToScan = Math.min(
            latestBlock - lastScannedBlock,
            MAX_TOKEN_DISCOVERY_BATCH
          );
          
          if (blocksToScan > 0) {
            const newTokens = await discoverB20Tokens(
              lastScannedBlock,
              lastScannedBlock + blocksToScan
            );
            
            tokens = newTokens.map(t => ({
              address: t.address,
              txHash: t.txHash,
              createdAt: 0, // Will be set during enrichment
            }));
            
            saveScanCursor(lastScannedBlock + blocksToScan);
          }
          break;
      }
      
      // Enrich tokens with metadata
      for (const token of tokens) {
        if (allTokens.length >= limit) break;
        
        const enriched = await enrichTokenData(token, discoveredRef);
        if (enriched) {
          allTokens.push(enriched);
        }
      }
      
    } catch (error) {
      console.error(`Error with ${source} source:`, error);
      continue; // Try next source
    }
  }
  
  return allTokens;
}

export function useB20Tokens() {
  const [tokens, setTokens] = useState<B20Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastScannedBlock, setLastScannedBlock] = useState<number>(() => loadScanCursor());
  const [currentBlock, setCurrentBlock] = useState<number>(0);
  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const discoveredRef = useRef<Set<string>>(new Set());

  const discoverTokens = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const latestBlock = await getCurrentBlockNumber();
      setCurrentBlock(latestBlock);
      
      // Try to discover tokens using the best available source
      const newTokens = await discoverTokensWithFallback(discoveredRef, 500);
      
      if (newTokens.length > 0) {
        // Determine which source was used
        const factoryTokens = await fetchTokensFromFactory(1);
        if (factoryTokens.length > 0) {
          setDataSource(DATA_SOURCE.FACTORY);
        } else {
          const thirdPartyTokens = await fetchTokensFromThirdParty(1);
          if (thirdPartyTokens.length > 0) {
            setDataSource(DATA_SOURCE.THIRD_PARTY);
          } else {
            setDataSource(DATA_SOURCE.BLOCK_SCAN);
          }
        }
        
        // Fetch market overlay for newly discovered tokens
        const overlay = await fetchMarketOverlay(
          newTokens.map((t) => t.address),
        );
        const withMarket = newTokens.map((t) => {
          const md = overlay.get(t.address.toLowerCase());
          return md ? { ...t, marketData: md } : t;
        });
        
        setTokens((prev) => {
          const existing = new Set(prev.map((t) => t.address.toLowerCase()));
          const unique = withMarket.filter(
            (t) => !existing.has(t.address.toLowerCase())
          );
          return [...unique, ...prev];
        });
      }
      
      setLoading(false);
    } catch (err) {
      console.error("Error discovering B20 tokens:", err);
      setError(err instanceof Error ? err.message : "Failed to discover tokens");
      setLoading(false);
    }
  }, []);

  // Initial discovery
  useEffect(() => {
    discoverTokens();
  }, [discoverTokens]);

  // Poll for new tokens
  useEffect(() => {
    const interval = setInterval(() => {
      discoverTokens();
    }, POLLING_INTERVAL * 3); // less frequent than event polling
    return () => clearInterval(interval);
  }, [discoverTokens]);

  // Periodically refresh metadata for existing tokens
  useEffect(() => {
    if (tokens.length === 0) return;

    const refreshInterval = setInterval(async () => {
      try {
        const updated = await Promise.all(
          tokens.slice(0, 20).map(async (token) => {
            try {
              const meta = await fetchTokenMetadata(token.address);
              return { ...token, totalSupply: meta.totalSupply };
            } catch {
              return token;
            }
          })
        );
        setTokens((prev) => {
          const updateMap = new Map(updated.map((t) => [t.address, t]));
          return prev.map((t) => updateMap.get(t.address) || t);
        });
      } catch {
        // ignore refresh errors
      }
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [tokens]);

  // Periodically refresh MARKET DATA for the top-N tokens (price, mcap, volume)
  // Uses a ref to avoid stale closure over `tokens`.
  const tokensRef = useRef<B20Token[]>([]);
  useEffect(() => {
    tokensRef.current = tokens;
  }, [tokens]);

  useEffect(() => {
    if (tokens.length === 0) return;

    const refreshMarket = async () => {
      try {
        const current = tokensRef.current;
        if (current.length === 0) return;
        const targets = current
          .slice(0, MARKET_OVERLAY_LIMIT)
          .map((t) => t.address);
        const overlay = await fetchMarketOverlay(targets);
        if (overlay.size === 0) return;
        setTokens((prev) =>
          prev.map((t) => {
            const md = overlay.get(t.address.toLowerCase());
            return md ? { ...t, marketData: md } : t;
          }),
        );
      } catch {
        // Market overlay is best-effort
      }
    };

    // Run once on mount of the effect, then on cadence
    refreshMarket();
    const marketInterval = setInterval(refreshMarket, MARKET_REFRESH_MS);
    return () => clearInterval(marketInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens.length === 0 ? "empty" : "populated"]);

  return { tokens, loading, error, currentBlock, lastScannedBlock, dataSource };
}
