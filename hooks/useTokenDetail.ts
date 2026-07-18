"use client";

import { useState, useEffect, useCallback } from "react";
import type { B20Event, TokenMarketData } from "@/lib/types";
import { fetchTokenMetadata, fetchTokenEvents, getBlockTimestamp, getCurrentBlockNumber } from "@/lib/b20-client";
import { decodeTransferEvent } from "@/lib/event-decoder";

// Market data refresh cadence for token detail page (more aggressive than list view)
const MARKET_REFRESH_MS = 15_000;

/**
 * Fetch market data for a single token via the server-side API route.
 * Best-effort: returns null on failure so UI can show "—" placeholders.
 */
async function fetchMarketData(address: string): Promise<TokenMarketData | null> {
  try {
    const res = await fetch(`/api/market?address=${address}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as TokenMarketData;
  } catch {
    return null;
  }
}

export function useTokenDetail(tokenAddress: string) {
  const [metadata, setMetadata] = useState<{
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: bigint;
    currency?: string;
  } | null>(null);
  const [events, setEvents] = useState<B20Event[]>([]);
  const [marketData, setMarketData] = useState<TokenMarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch metadata + market data in parallel
      const [meta, market] = await Promise.all([
        fetchTokenMetadata(tokenAddress),
        fetchMarketData(tokenAddress),
      ]);
      setMetadata(meta);
      setMarketData(market);

      // Fetch recent events (last 5000 blocks ≈ ~2.8 hours)
      const currentBlock = await getCurrentBlockNumber();
      const fromBlock = currentBlock - 5000;
      const logs = await fetchTokenEvents(tokenAddress, fromBlock, currentBlock);

      const decoded: B20Event[] = [];
      for (const log of logs) {
        const event = decodeTransferEvent({
          topics: log.topics,
          data: log.data,
          blockNumber: log.blockNumber,
          txHash: log.txHash,
          logIndex: log.logIndex,
          address: tokenAddress,
        });
        if (event) {
          try {
            event.timestamp = await getBlockTimestamp(log.blockNumber);
          } catch {
            event.timestamp = 0;
          }
          decoded.push(event);
        }
      }

      // Sort by block number descending (newest first)
      decoded.sort((a, b) => b.blockNumber - a.blockNumber);
      setEvents(decoded.slice(0, 100)); // limit to 100 events

      setError(null);
    } catch (err) {
      console.error("Error fetching token detail:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch token detail");
    } finally {
      setLoading(false);
    }
  }, [tokenAddress]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Poll for updates every 5s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        // Fetch only latest metadata
        const meta = await fetchTokenMetadata(tokenAddress);
        setMetadata(meta);

        // Fetch latest events
        const currentBlock = await getCurrentBlockNumber();
        const lastEventBlock = events.length > 0 ? events[0].blockNumber : currentBlock - 10;
        const logs = await fetchTokenEvents(tokenAddress, lastEventBlock + 1, currentBlock);

        const newDecoded: B20Event[] = [];
        for (const log of logs) {
          const event = decodeTransferEvent({
            topics: log.topics,
            data: log.data,
            blockNumber: log.blockNumber,
            txHash: log.txHash,
            logIndex: log.logIndex,
            address: tokenAddress,
          });
          if (event) {
            try {
              event.timestamp = await getBlockTimestamp(log.blockNumber);
            } catch {
              event.timestamp = 0;
            }
            newDecoded.push(event);
          }
        }

        if (newDecoded.length > 0) {
          setEvents((prev) => [...newDecoded.reverse(), ...prev].slice(0, 100));
        }
      } catch {
        // ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [tokenAddress, events.length]);

  // Poll MARKET DATA every 15s (separate cadence from metadata/events)
  useEffect(() => {
    if (!tokenAddress) return;

    const refreshMarket = async () => {
      const market = await fetchMarketData(tokenAddress);
      if (market) setMarketData(market);
    };

    // Run once immediately, then on 15s cadence
    refreshMarket();
    const marketInterval = setInterval(refreshMarket, MARKET_REFRESH_MS);
    return () => clearInterval(marketInterval);
  }, [tokenAddress]);

  return { metadata, events, marketData, loading, error, refetch: fetchDetail };
}
