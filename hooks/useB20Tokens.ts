"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { B20Token } from "@/lib/types";
import {
  discoverB20Tokens,
  fetchTokenMetadata,
  getCurrentBlockNumber,
  getBlockTimestamp,
} from "@/lib/b20-client";
import { POLLING_INTERVAL, MAX_TOKEN_DISCOVERY_BATCH } from "@/lib/constants";

// Estimate B20 activation block (~June 26, 2025)
// Base blocks: ~2s per block. June 26, 2025 ≈ block ~25,000,000
const B20_ACTIVATION_BLOCK = 25000000;

// ─── Cache helpers ──────────────────────────────────────────────────────────
async function loadCachedScanState(): Promise<{
  lastScannedBlock: number;
  tokens: B20Token[];
} | null> {
  try {
    const res = await fetch("/api/scan-state");
    if (!res.ok) return null;
    const data = await res.json();

    const lastScannedBlock =
      typeof data.lastScannedBlock === "number" && data.lastScannedBlock > 0
        ? data.lastScannedBlock
        : 0;

    // Convert cached token summaries into full B20Token objects
    const tokens: B20Token[] = Array.isArray(data.tokens)
      ? data.tokens.map(
          (t: {
            address: string;
            name: string;
            symbol: string;
            variant: "asset" | "stablecoin";
            decimals: number;
            currency?: string;
            txHash: string;
            createdAt: number;
          }) => ({
            address: t.address,
            name: t.name,
            symbol: t.symbol,
            variant: t.variant,
            decimals: t.decimals,
            currency: t.currency,
            totalSupply: BigInt(0), // will be refreshed by metadata poller
            supplyCap: BigInt(0),
            creator: "",
            createdAt: t.createdAt,
            txHash: t.txHash,
            isPaused: false,
          }),
        )
      : [];

    return { lastScannedBlock, tokens };
  } catch (err) {
    console.warn("[useB20Tokens] Failed to load cache, starting fresh:", err);
    return null;
  }
}

async function persistDiscoveries(
  newTokens: B20Token[],
  lastScannedBlock: number,
): Promise<void> {
  try {
    // Send only the fields the cache needs (no BigInt — not JSON-serializable)
    const cacheable = newTokens.map((t) => ({
      address: t.address,
      name: t.name,
      symbol: t.symbol,
      variant: t.variant,
      decimals: t.decimals,
      currency: t.currency,
      txHash: t.txHash,
      createdAt: t.createdAt,
    }));

    await fetch("/api/scan-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newTokens: cacheable, lastScannedBlock }),
    });
  } catch (err) {
    // Non-critical — scan continues even if cache write fails
    console.warn("[useB20Tokens] Failed to persist discoveries:", err);
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────
export function useB20Tokens() {
  const [tokens, setTokens] = useState<B20Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastScannedBlock, setLastScannedBlock] = useState<number>(B20_ACTIVATION_BLOCK);
  const [currentBlock, setCurrentBlock] = useState<number>(0);
  const discoveredRef = useRef<Set<string>>(new Set());
  const cacheLoadedRef = useRef(false);

  // ── Load cached state on mount ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadCache() {
      const cached = await loadCachedScanState();
      if (cancelled) return;

      if (cached && cached.lastScannedBlock > B20_ACTIVATION_BLOCK) {
        // Populate from cache
        setLastScannedBlock(cached.lastScannedBlock);
        if (cached.tokens.length > 0) {
          setTokens(cached.tokens);
          cached.tokens.forEach((t) =>
            discoveredRef.current.add(t.address.toLowerCase()),
          );
        }
      }

      cacheLoadedRef.current = true;
    }

    loadCache();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Discover new tokens (runs after cache is loaded) ──────────────────
  const discoverTokens = useCallback(async () => {
    if (!cacheLoadedRef.current) return;

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
        const variant = meta.currency ? "stablecoin" : "asset";

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
        setTokens((prev) => {
          const existing = new Set(prev.map((t) => t.address.toLowerCase()));
          const unique = enriched.filter(
            (t) => !existing.has(t.address.toLowerCase())
          );
          return [...unique, ...prev];
        });
      }

      const newLastBlock = lastScannedBlock + blocksToScan;
      setLastScannedBlock(newLastBlock);
      setError(null);

      // Persist to cache (fire-and-forget, only when new tokens found)
      persistDiscoveries(enriched, newLastBlock);
    } catch (err) {
      console.error("Error discovering B20 tokens:", err);
      setError(err instanceof Error ? err.message : "Failed to discover tokens");
    }
  }, [lastScannedBlock]);

  // Initial discovery (after cache load)
  useEffect(() => {
    if (!cacheLoadedRef.current) return;
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

  return { tokens, loading, error, currentBlock, lastScannedBlock };
}
