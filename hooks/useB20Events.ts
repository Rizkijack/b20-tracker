"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { B20Event } from "@/lib/types";
import {
  getCurrentBlockNumber,
  getBlockTimestamp,
  fetchRecentB20Transfers,
} from "@/lib/api-client";
import { decodeAnyEvent } from "@/lib/event-decoder";
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
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processRawEvent = useCallback(async (raw: {
    id: string;
    address: string;
    topics: string[];
    data: string;
    blockNumber: number;
    txHash: string;
    logIndex: number;
  }) => {
    const event = decodeAnyEvent({
      ...raw,
      address: raw.address,
    });
    if (!event) return null;
    if (knownIdsRef.current.has(event.id)) return null;
    knownIdsRef.current.add(event.id);

    // Get timestamp
    try {
      event.timestamp = await getBlockTimestamp(raw.blockNumber);
    } catch {
      event.timestamp = Math.floor(Date.now() / 1000);
    }

    return event;
  }, []);

  // Initial fetch via REST (for immediate data)
  const initialFetch = useCallback(async () => {
    try {
      const latestBlock = await getCurrentBlockNumber();
      setCurrentBlock(latestBlock);

      if (lastBlockRef.current === 0) {
        lastBlockRef.current = latestBlock - 100;
      }

      const fromBlock = lastBlockRef.current + 1;
      const toBlock = latestBlock;

      if (fromBlock > toBlock) return;

      const logs = await fetchRecentB20Transfers(fromBlock, toBlock);

      const decodedEvents: B20Event[] = [];
      for (const log of logs) {
        const event = await processRawEvent({
          id: `${log.txHash}-${log.logIndex}`,
          address: log.address || "",
          topics: log.topics,
          data: log.data,
          blockNumber: log.blockNumber,
          txHash: log.txHash,
          logIndex: log.logIndex,
        });
        if (!event) continue;
        decodedEvents.push(event);
      }

      if (decodedEvents.length > 0) {
        setEvents((prev) => {
          const newEvents = decodedEvents.reverse();
          const combined = [...newEvents, ...prev];
          if (combined.length > MAX_LIVE_EVENTS) {
            const removed = combined.slice(MAX_LIVE_EVENTS);
            removed.forEach((e) => knownIdsRef.current.delete(e.id));
            return combined.slice(0, MAX_LIVE_EVENTS);
          }
          return combined;
        });
      }

      lastBlockRef.current = latestBlock;
    } catch (err) {
      console.error("Initial fetch error:", err);
    }
  }, [processRawEvent]);

  // Connect to SSE stream
  useEffect(() => {
    let mounted = true;

    const connect = () => {
      if (!mounted) return;

      const es = new EventSource("/api/events/stream");
      eventSourceRef.current = es;

      es.onopen = () => {
        console.log("SSE connected");
      };

      es.onmessage = async (e) => {
        try {
          const data = JSON.parse(e.data);

          // Heartbeat
          if (data.type === "heartbeat") {
            setCurrentBlock(data.block);
            return;
          }

          // Event
          const event = await processRawEvent(data);
          if (!event) return;

          setEvents((prev) => {
            const combined = [event, ...prev];
            if (combined.length > MAX_LIVE_EVENTS) {
              const removed = combined.slice(MAX_LIVE_EVENTS);
              removed.forEach((e) => knownIdsRef.current.delete(e.id));
              return combined.slice(0, MAX_LIVE_EVENTS);
            }
            return combined;
          });
        } catch (err) {
          console.error("SSE message error:", err);
        }
      };

      es.onerror = (err) => {
        console.error("SSE error:", err);
        es.close();
        eventSourceRef.current = null;

        // Reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (mounted) connect();
        }, 5000);
      };
    };

    connect();

    return () => {
      mounted = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [processRawEvent]);

  // Initial fetch
  useEffect(() => {
    initialFetch().then(() => setLoading(false));
  }, [initialFetch]);

  // Fallback polling (if SSE fails, keep polling as backup)
  useEffect(() => {
    const interval = setInterval(async () => {
      // Only poll if we haven't received events recently (SSE might be dead)
      // Simple heuristic: if lastBlockRef hasn't updated in 2 intervals, force poll
      const now = Date.now();
      if (!eventSourceRef.current || now - (lastBlockRef.current as any) > POLLING_INTERVAL * 2) {
        await initialFetch();
      }
    }, POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [initialFetch]);

  return { events, loading, error, currentBlock };
}
