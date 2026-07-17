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

  // Resolve token metadata for events (with caching)
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

  // Auto-scroll to top on new events
  useEffect(() => {
    if (feedRef.current && events.length > prevEventCount.current) {
      feedRef.current.scrollTop = 0;
    }
    prevEventCount.current = events.length;
  }, [events.length]);

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
          </span>
          <h2 className="text-sm font-semibold text-white">Live Event Feed</h2>
          <span className="text-[11px] text-gray-500 font-mono">
            {events.length}
          </span>
        </div>
        <span className="text-[10px] text-gray-500 uppercase tracking-[0.06em]">
          Latest
        </span>
      </div>

      {/* Event List */}
      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.03] mb-3">
            <svg className="h-6 w-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm text-gray-400">Listening for B20 events...</p>
          <p className="text-xs text-gray-600 mt-1">
            Events will appear here in real-time
          </p>
        </div>
      ) : (
        <div
          ref={feedRef}
          className="h-[480px] overflow-y-auto scrollbar-custom divide-y divide-white/[0.04]"
        >
          {events.map((event, index) => (
            <div
              key={event.id}
              className={`animate-slide-in px-4 py-2.5 transition-colors hover:bg-white/[0.02] ${
                index === 0 ? "bg-[#3B82F6]/[0.02]" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Event icon */}
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-[11px] shrink-0 mt-0.5">
                  {getEventIcon(event.type)}
                </div>

                {/* Event content */}
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
                      className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {tokenMeta[event.tokenAddress]?.symbol || truncateAddress(event.tokenAddress, 4)}
                    </Link>
                  )}

                    <span className="text-[11px] text-gray-500 truncate">
                      {getEventDescription(event)}
                    </span>
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-3 mt-1">
                    {/* Amount */}
                    {event.amount && event.amount > BigInt(0) && (
                      <span className="text-[11px] font-mono text-gray-400 tabular-nums">
                        <span className={event.type === "mint" ? "text-green-400" : event.type === "burn" ? "text-red-400" : ""}>
                          {event.type === "mint" ? "+" : event.type === "burn" ? "-" : ""}
                          {tokenMeta[event.tokenAddress]
                            ? formatTokenAmount(event.amount, tokenMeta[event.tokenAddress].decimals)
                            : event.amount.toString().slice(0, 10)}
                        </span>
                      </span>
                    )}

                    {/* Time */}
                    <span className="text-[10px] text-gray-600 font-mono tabular-nums" title={formatTime(event.timestamp)}>
                      {formatTimeAgo(event.timestamp)}
                    </span>

                    {/* Tx Link */}
                    <a
                      href={`${EXPLORER_URL}/tx/${event.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-gray-600 hover:text-blue-400 font-mono transition-colors"
                    >
                      {truncateAddress(event.txHash, 3)}
                    </a>

                    {/* Block number */}
                    <span className="text-[10px] text-gray-600 font-mono">
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
