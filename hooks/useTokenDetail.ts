"use client";

import { useState, useEffect, useCallback } from "react";
import type { B20Event } from "@/lib/types";
import { fetchTokenMetadata, fetchTokenEvents, getBlockTimestamp, getCurrentBlockNumber } from "@/lib/api-client";
import { decodeTransferEvent } from "@/lib/event-decoder";

export function useTokenDetail(tokenAddress: string) {
  const [metadata, setMetadata] = useState<{
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: bigint;
    currency?: string;
  } | null>(null);
  const [events, setEvents] = useState<B20Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch metadata
      const meta = await fetchTokenMetadata(tokenAddress);
      setMetadata(meta);

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

  return { metadata, events, loading, error, refetch: fetchDetail };
}
