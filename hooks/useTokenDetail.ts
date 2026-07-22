"use client";

import { useState, useEffect, useCallback } from "react";
import type { B20Event, TokenMarketData } from "@/lib/types";
import { decodeB20Event } from "@/lib/event-decoder";

const MARKET_REFRESH_MS = 15_000;

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
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

      const [meta, market, blockData] = await Promise.all([
        fetchJson<{
          name: string;
          symbol: string;
          decimals: number;
          totalSupply: string;
          currency?: string;
        }>(`/api/metadata?address=${tokenAddress}`),
        fetchJson<TokenMarketData>(`/api/market?address=${tokenAddress}`),
        fetchJson<{ blockNumber: number }>("/api/block/current"),
      ]);

      if (meta) {
        setMetadata({ ...meta, totalSupply: BigInt(meta.totalSupply || "0") });
      }
      if (market) setMarketData(market);

      const currentBlock = blockData?.blockNumber ?? 0;
      if (currentBlock > 0) {
        const fromBlock = currentBlock - 5000;
        const logs = await fetchJson<{
          topics: string[];
          data: string;
          blockNumber: number;
          txHash: string;
          logIndex: number;
        }[]>(`/api/token-events?address=${tokenAddress}&fromBlock=${fromBlock}&toBlock=${currentBlock}`);

        if (logs) {
          const decoded: B20Event[] = [];
          for (const log of logs) {
            const event = decodeB20Event({
              ...log,
              address: tokenAddress,
            });
            if (event) {
              try {
                const tsData = await fetchJson<{ timestamp: number }>(
                  `/api/block/timestamp?blockNumber=${log.blockNumber}`,
                );
                event.timestamp = tsData?.timestamp ?? 0;
              } catch {
                event.timestamp = 0;
              }
              decoded.push(event);
            }
          }
          decoded.sort((a, b) => b.blockNumber - a.blockNumber);
          setEvents(decoded.slice(0, 100));
        }
      }

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

  // Poll for latest events every 5s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const blockData = await fetchJson<{ blockNumber: number }>("/api/block/current");
        const currentBlock = blockData?.blockNumber ?? 0;
        if (currentBlock === 0) return;

        const lastEventBlock = events.length > 0 ? events[0].blockNumber : currentBlock - 10;
        const logs = await fetchJson<{
          topics: string[];
          data: string;
          blockNumber: number;
          txHash: string;
          logIndex: number;
        }[]>(`/api/token-events?address=${tokenAddress}&fromBlock=${lastEventBlock + 1}&toBlock=${currentBlock}`);

        if (logs && logs.length > 0) {
          const decoded: B20Event[] = [];
          for (const log of logs) {
            const event = decodeB20Event({ ...log, address: tokenAddress });
            if (event) {
              const tsData = await fetchJson<{ timestamp: number }>(
                `/api/block/timestamp?blockNumber=${log.blockNumber}`,
              );
              event.timestamp = tsData?.timestamp ?? 0;
              decoded.push(event);
            }
          }
          if (decoded.length > 0) {
            setEvents((prev) => [...decoded.reverse(), ...prev].slice(0, 100));
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [tokenAddress, events.length]);

  // Poll market data every 15s
  useEffect(() => {
    if (!tokenAddress) return;

    const refreshMarket = async () => {
      const market = await fetchJson<TokenMarketData>(`/api/market?address=${tokenAddress}`);
      if (market) setMarketData(market);
    };

    refreshMarket();
    const marketInterval = setInterval(refreshMarket, MARKET_REFRESH_MS);
    return () => clearInterval(marketInterval);
  }, [tokenAddress]);

  return { metadata, events, marketData, loading, error, refetch: fetchDetail };
}
