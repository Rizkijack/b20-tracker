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

export function useB20Tokens() {
  const [tokens, setTokens] = useState<B20Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastScannedBlock, setLastScannedBlock] = useState<number>(() => loadScanCursor());
  const [currentBlock, setCurrentBlock] = useState<number>(0);
  const discoveredRef = useRef<Set<string>>(new Set());

  const discoverTokens = useCallback(async () => {
    try {
      const latestBlock = await getCurrentBlockNumber();
      setCurrentBlock(latestBlock);

      // Calculate how many blocks to scan (limit to prevent timeout)
      const blocksToScan = Math.min(
        latestBlock - lastScannedBlock,
        MAX_TOKEN_DISCOVERY_BATCH
      );

      if (blocksToScan <= 0) return;

      const newTokens = await discoverB20Tokens(
        lastScannedBlock,
        lastScannedBlock + blocksToScan
      );

      // Fetch metadata for newly discovered tokens
      const enriched: B20Token[] = [];
      for (const t of newTokens) {
        const addrLower = t.address.toLowerCase();
        if (discoveredRef.current.has(addrLower)) continue;
        discoveredRef.current.add(addrLower);

        const meta = await fetchTokenMetadata(t.address);
        const timestamp = await getBlockTimestamp(t.blockNumber);
        const variant = detectVariant(t.address);

        enriched.push({
          address: t.address,
          name: meta.name,
          symbol: meta.symbol,
          variant,
          decimals: meta.decimals,
          currency: meta.currency,
          totalSupply: meta.totalSupply,
          supplyCap: BigInt(0), // fetched separately if needed
          creator: "", // not available from Transfer logs alone
          createdAt: timestamp,
          txHash: t.txHash,
          isPaused: false,
        });
      }

      if (enriched.length > 0) {
        // Fire market overlay fetch for newly discovered tokens (best-effort)
        const overlay = await fetchMarketOverlay(
          enriched.map((t) => t.address),
        );
        const withMarket = enriched.map((t) => {
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

      setLastScannedBlock(lastScannedBlock + blocksToScan);
      saveScanCursor(lastScannedBlock + blocksToScan);
      setError(null);
    } catch (err) {
      console.error("Error discovering B20 tokens:", err);
      setError(err instanceof Error ? err.message : "Failed to discover tokens");
    }
  }, [lastScannedBlock]);

  // Initial discovery
  useEffect(() => {
    discoverTokens().then(() => setLoading(false));
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

  return { tokens, loading, error, currentBlock, lastScannedBlock };
}
