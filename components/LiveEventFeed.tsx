"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { B20Event } from "@/lib/types";
import {
  truncateAddress,
  isB20Address,
  fetchTokenMetadata,
  formatAmount as formatTokenAmount,
} from "@/lib/b20-client";
import {
  getEventBadgeColor,
  getEventIcon,
  getEventLabel,
  getEventDescription,
} from "@/lib/event-decoder";
import { EXPLORER_URL } from "@/lib/constants";

interface LiveEventFeedProps {
  events: B20Event[];
}

function formatTimeAgo(timestamp: number): string {
  if (!timestamp) return "";
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (diff < 10) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatTime(timestamp: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function LiveEventFeed({ events }: LiveEventFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const [tokenMeta, setTokenMeta] = useState<Record<string, { symbol: string; decimals: number }>>({});
  const prevEventCount = useRef(0);
  const resolvedRef = useRef<Set<string>>(new Set());
  const latestEventRef = useRef<string>("");
  const liveRegionRef = useRef<HTMLDivElement>(null);

  // Resolve token names for events (with caching)
  useEffect(() => {
    const resolveMeta = async () => {
      const batch: Record<string, { symbol: string; decimals: number }> = {};
      for (const event of events.slice(0, 20)) {
        if (batch[event.tokenAddress] || resolvedRef.current.has(event.tokenAddress)) continue;
        resolvedRef.current.add(event.tokenAddress);
        try {
          const meta = await fetchTokenMetadata(event.tokenAddress);
          batch[event.tokenAddress] = { symbol: meta.symbol, decimals: meta.decimals };
        } catch {
          batch[event.tokenAddress] = { symbol: truncateAddress(event.tokenAddress, 4), decimals: 18 };
        }
      }
      if (Object.keys(batch).length > 0) {
        setTokenMeta((prev) => ({ ...prev, ...batch }));
      }
    };
    resolveMeta();
  }, [events]);

  // Track latest event for screen reader
  useEffect(() => {
    if (events.length > 0 && events[0]?.id !== latestEventRef.current) {
      latestEventRef.current = events[0]?.id || "";
      const event = events[0];
      if (event) {
        const meta = tokenMeta[event.tokenAddress];
        const name = meta?.symbol || truncateAddress(event.tokenAddress, 4);
        const announce = `${getEventLabel(event.type)}: ${name} - ${getEventDescription(event)}`;
        if (liveRegionRef.current) {
          liveRegionRef.current.textContent = announce;
        }
      }
    }
  }, [events, tokenMeta]);

  // Auto-scroll to top on new events
  useEffect(() => {
    if (feedRef.current && events.length > prevEventCount.current) {
      feedRef.current.scrollTop = 0;
    }
    prevEventCount.current = events.length;
  }, [events.length]);

  return (
    <div className="glass-card overflow-hidden" role="region" aria-label="Live event feed">
      {/* Hidden live region for screen readers */}
      <div
        ref={liveRegionRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      ></div>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
          </span>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Live Event Feed</h2>
          <span className="text-[11px] font-mono" style={{ color: "var(--text-tertiary)" }} aria-label={`${events.length} events tracked`}>
            {events.length}
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-[0.06em]" style={{ color: "var(--text-tertiary)" }}>
          Latest
        </span>
      </div>

      {/* Event List */}
      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.03] mb-3">
            <svg className="h-6 w-6" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Listening for B20 events...</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Events will appear here in real-time
          </p>
        </div>
      ) : (
        <div
          ref={feedRef}
          className="h-[480px] overflow-y-auto scrollbar-custom divide-y divide-[var(--border-subtle)]"
          role="log"
          aria-label="Recent events log"
          aria-live="off"
        >
          {events.map((event, index) => (
            <div
              key={event.id}
              className={`animate-slide-in px-4 py-2.5 transition-colors hover:bg-[var(--accent-blue-dim)] ${
                index === 0 ? "bg-[var(--accent-blue-dim)]" : ""
              }`}
              role="article"
              aria-label={`${getEventLabel(event.type)} event - ${tokenMeta[event.tokenAddress]?.symbol || truncateAddress(event.tokenAddress, 4)}`}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-[11px] shrink-0 mt-0.5" aria-hidden="true">
                  {getEventIcon(event.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${getEventBadgeColor(event.type)}`}
                    >
                      {getEventLabel(event.type)}
                    </span>

                    {/* Token name link */}
                    {isB20Address(event.tokenAddress) && (
                      <Link
                        href={`/token/${event.tokenAddress}`}
                        className="text-[11px] font-semibold text-[var(--accent-blue)] hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/50"
                        aria-label={`View ${tokenMeta[event.tokenAddress]?.symbol || truncateAddress(event.tokenAddress, 4)} details`}
                      >
                        {tokenMeta[event.tokenAddress]?.symbol || truncateAddress(event.tokenAddress, 4)}
                      </Link>
                    )}

                    <span className="text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>
                      {getEventDescription(event)}
                    </span>
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-3 mt-1">
                    {event.amount && event.amount > BigInt(0) && (
                      <span className="text-[11px] font-mono tabular-nums" style={{ color: "var(--text-secondary)" }}>
                        <span className={event.type === "mint" ? "text-[var(--accent-green)]" : event.type === "burn" ? "text-[var(--accent-red)]" : ""}>
                          {event.type === "mint" ? "+" : event.type === "burn" ? "-" : ""}
                          {tokenMeta[event.tokenAddress]
                            ? formatTokenAmount(event.amount, tokenMeta[event.tokenAddress].decimals)
                            : event.amount.toString().slice(0, 10)}
                        </span>
                      </span>
                    )}

                    <span className="text-[10px] font-mono tabular-nums" style={{ color: "var(--text-muted)" }} title={formatTime(event.timestamp)}>
                      {formatTimeAgo(event.timestamp)}
                    </span>

                    <a
                      href={`${EXPLORER_URL}/tx/${event.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/50"
                      style={{ color: "var(--text-muted)" }}
                      aria-label={`View transaction ${truncateAddress(event.txHash, 3)} on Basescan`}
                    >
                      {truncateAddress(event.txHash, 3)}
                    </a>

                    <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                      #{event.blockNumber}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
