"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { B20Event } from "@/lib/types";
import {
  fetchRecentB20Transfers,
  getCurrentBlockNumber,
  getBlockTimestamp,
  isB20Address,
} from "@/lib/b20-client";
import { decodeTransferEvent } from "@/lib/event-decoder";
import {
  POLLING_INTERVAL,
  MAX_LIVE_EVENTS,
} from "@/lib/constants";

export function useB20Events() {
  const [events, setEvents] = useState<B20Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentBlock, setCurrentBlock] = useState<number>(0);
  const lastBlockRef = useRef<number>(0);
  const knownIdsRef = useRef<Set<string>>(new Set());

  const pollEvents = useCallback(async () => {
    try {
      const latestBlock = await getCurrentBlockNumber();
      setCurrentBlock(latestBlock);

      if (lastBlockRef.current === 0) {
        lastBlockRef.current = latestBlock - 100; // initial lookback
      }

      const fromBlock = lastBlockRef.current + 1;
      const toBlock = latestBlock;

      if (fromBlock > toBlock) return;

      const logs = await fetchRecentB20Transfers(fromBlock, toBlock);

      const decodedEvents: B20Event[] = [];
      for (const log of logs) {
        const event = decodeTransferEvent(log);
        if (!event) continue;
        if (knownIdsRef.current.has(event.id)) continue;
        knownIdsRef.current.add(event.id);

        // Get timestamp
        try {
          event.timestamp = await getBlockTimestamp(log.blockNumber);
        } catch {
          event.timestamp = Math.floor(Date.now() / 1000);
        }

        decodedEvents.push(event);
      }

      if (decodedEvents.length > 0) {
        setEvents((prev) => {
          const newEvents = decodedEvents.reverse(); // newest first
          const combined = [...newEvents, ...prev];
          // Keep only MAX_LIVE_EVENTS
          if (combined.length > MAX_LIVE_EVENTS) {
            // Clean up known IDs ref
            const removed = combined.slice(MAX_LIVE_EVENTS);
            removed.forEach((e) => knownIdsRef.current.delete(e.id));
            return combined.slice(0, MAX_LIVE_EVENTS);
          }
          return combined;
        });
      }

      lastBlockRef.current = latestBlock;
      setError(null);
    } catch (err) {
      console.error("Error polling events:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch events");
    }
  }, []);

  // Initial poll
  useEffect(() => {
    pollEvents().then(() => setLoading(false));
  }, [pollEvents]);

  // Continuous polling
  useEffect(() => {
    const interval = setInterval(pollEvents, POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [pollEvents]);

  return { events, loading, error, currentBlock };
}
