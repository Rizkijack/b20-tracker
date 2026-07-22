"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { B20Token, TokenMarketData } from "@/lib/types";
import { detectVariant } from "@/lib/b20-client";
import { POLLING_INTERVAL } from "@/lib/constants";

// Market data refresh cadence (ms) for the top-N tokens already loaded.
const MARKET_REFRESH_MS = 30_000;
const MAX_TOKENS = 100;

// Shape returned by /api/b20-discover (lib/b20-discovery.ts::B20TokenWithMarket).
interface DiscoveredB20Token {
  address: string;
  blockNumber: number;
  txHash: string;
  variant: number;
  name: string;
  symbol: string;
  decimals: number;
  marketData?: TokenMarketData;
  hasLiquidity: boolean;
}

type DiscoverResponse = {
  success: boolean;
  count: number;
  currentBlock: number;
  source: "factory" | "dex" | "mixed";
  tokens: DiscoveredB20Token[];
  timestamp: number;
};

export type B20DataSource = "factory" | "dex" | "mixed";

/**
 * Discover B20 tokens with real-time market data by hitting the server-side
 * /api/b20-discover route. That route scans B20Created events from the B20
 * factory precompile and enriches them with DexScreener + GeckoTerminal market
 * data (price/liquidity/volume) — both free, no API key required.
 */
async function discoverB20TokensViaApi(
  limit: number,
): Promise<{ tokens: DiscoveredB20Token[]; currentBlock: number; source: B20DataSource } | null> {
  try {
    const res = await fetch(`/api/b20-discover?limit=${limit}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as DiscoverResponse;
    if (!data.success || !Array.isArray(data.tokens)) return null;
    return {
      tokens: data.tokens,
      currentBlock: data.currentBlock,
      source: data.source,
    };
  } catch (error) {
    console.error("Error discovering tokens via /api/b20-discover:", error);
    return null;
  }
}

export function useB20Tokens() {
  const [tokens, setTokens] = useState<B20Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentBlock, setCurrentBlock] = useState<number>(0);
  const [dataSource, setDataSource] = useState<B20DataSource>("factory");
  const discoveredRef = useRef<Set<string>>(new Set());

  const discoverTokens = useCallback(async () => {
    try {
      setError(null);

      const result = await discoverB20TokensViaApi(MAX_TOKENS);
      if (!result) {
        setLoading(false);
        return;
      }

      const { tokens: discovered, currentBlock: block, source } = result;
      if (block > 0) setCurrentBlock(block);
      setDataSource(source);

      // De-duplicate against what we've already seen this session.
      const fresh: B20Token[] = [];
      for (const t of discovered) {
        const addrLower = t.address.toLowerCase();
        if (discoveredRef.current.has(addrLower)) continue;
        discoveredRef.current.add(addrLower);

        fresh.push({
          address: t.address,
          name: t.name || "Unknown",
          symbol: t.symbol || "???",
          variant:
            t.variant === 1
              ? "stablecoin"
              : t.variant === 0
                ? "asset"
                : detectVariant(t.address),
          decimals: t.decimals || 18,
          totalSupply: BigInt(0),
          supplyCap: BigInt(0),
          creator: "",
          createdAt: 0,
          txHash: t.txHash,
          isPaused: false,
          marketData: t.marketData,
        });
      }

      if (fresh.length > 0) {
        setTokens((prev) => {
          const existing = new Set(prev.map((t) => t.address.toLowerCase()));
          const unique = fresh.filter(
            (t) => !existing.has(t.address.toLowerCase()),
          );
          // Newest first; capped to MAX_TOKENS
          return [...unique, ...prev].slice(0, MAX_TOKENS * 2);
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

  // Poll for new tokens (less frequent than event polling)
  useEffect(() => {
    const interval = setInterval(() => {
      discoverTokens();
    }, POLLING_INTERVAL * 3);
    return () => clearInterval(interval);
  }, [discoverTokens]);

  // Periodically refresh MARKET DATA only (price/mcap/volume) for tokens that
  // already have liquidity, without re-running full discovery.
  const tokensRef = useRef<B20Token[]>([]);
  useEffect(() => {
    tokensRef.current = tokens;
  }, [tokens]);

  useEffect(() => {
    if (tokens.length === 0) return;

    const refreshMarket = async () => {
      try {
        // Re-discover to pull fresh prices; the server caches aggressively.
        await discoverTokens();
      } catch {
        // Market refresh is best-effort
      }
    };

    const marketInterval = setInterval(refreshMarket, MARKET_REFRESH_MS);
    return () => clearInterval(marketInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens.length === 0 ? "empty" : "populated"]);

  return { tokens, loading, error, currentBlock, lastScannedBlock: currentBlock, dataSource };
}
