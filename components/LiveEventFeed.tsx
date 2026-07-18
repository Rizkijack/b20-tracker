"use client";

import { useEffect, useRef, useState } from "react";
import type { B20Event } from "@/lib/types";
import {
  truncateAddress,
  formatAmount,
  isB20Address,
  fetchTokenMetadata,
} from "@/lib/b20-client";
import {
  getEventBadgeColor,
  getEventIcon,
  getEventLabel,
  getEventDescription,
} from "@/lib/event-decoder";
import { EXPLORER_URL, MAX_LIVE_EVENTS } from "@/lib/constants";
import Link from "next/link";

interface LiveEventFeedProps {
  events: B20Event[];
}

export default function LiveEventFeed({ events }: LiveEventFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const [tokenNames, setTokenNames] = useState<Record<string, string>>({});

  // Resolve token names for events
  useEffect(() => {
    const resolveNames = async () => {
      const names: Record<string, string> = {};
      for (const event of events.slice(0, 20)) {
        if (names[event.tokenAddress]) continue;
        try {
          const meta = await fetchTokenMetadata(event.tokenAddress);
          names[event.tokenAddress] = `${meta.symbol}`;
        } catch {
          names[event.tokenAddress] = truncateAddress(event.tokenAddress, 6);
        }
      }
      setTokenNames((prev) => ({ ...prev, ...names }));
    };
    resolveNames();
  }, [events]);

  // Auto-scroll to top on new events
  useEffect(() => {
    if (feedRef.current && events.length > 0) {
      feedRef.current.scrollTop = 0;
    }
  }, [events.length]);

  const formatTime = (timestamp: number) => {
    if (!timestamp) return "...";
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="rounded-xl glass-panel overflow-hidden flex flex-col h-[560px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
          </div>
          <h2 className="text-sm font-semibold text-white">Live Event Feed</h2>
        </div>
        <span className="text-xs text-gray-500">
          {events.length} events tracked
        </span>
      </div>

      {/* Event List */}
      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="text-4xl mb-3">📡</div>
          <p className="text-gray-400 text-sm">Listening for B20 events...</p>
          <p className="text-gray-600 text-xs mt-1">
            Events will appear here in real-time
          </p>
        </div>
      ) : (
        <div
          ref={feedRef}
          className="flex-1 overflow-y-auto divide-y divide-white/5 scrollbar-thin"
        >
          {events.map((event, index) => (
            <div
              key={event.id}
              className={`flex items-start gap-3 px-5 py-3.5 transition-all hover:bg-white/[0.04] ${
                index === 0 ? "bg-[#0052FF]/[0.05]" : ""
              }`}
            >
              {/* Event icon */}
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-sm shrink-0 mt-0.5">
                {getEventIcon(event.type)}
              </div>

              {/* Event content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getEventBadgeColor(
                      event.type
                    )}`}
                  >
                    {getEventLabel(event.type)}
                  </span>

                  {/* Token name link */}
                  {isB20Address(event.tokenAddress) && (
                    <Link
                      href={`/token/${event.tokenAddress}`}
                      className="text-xs font-semibold text-[#0052FF] hover:text-[#0052FF]/80 transition-colors"
                    >
                      {tokenNames[event.tokenAddress] ||
                        truncateAddress(event.tokenAddress, 6)}
                    </Link>
                  )}

                  <span className="text-xs text-gray-400">
                    {getEventDescription(event)}
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-1">
                  {/* Amount */}
                  {event.amount && event.amount > BigInt(0) && (
                    <span className="text-xs font-mono text-gray-300">
                      {event.type === "mint" ? "+" : event.type === "burn" ? "-" : ""}
                      {event.amount.toString().slice(0, 12)}
                      {event.amount.toString().length > 12 ? "..." : ""}
                    </span>
                  )}

                  <span className="text-[10px] text-gray-600 tabular-nums">
                    {formatTime(event.timestamp)}
                  </span>

                  {/* Tx link */}
                  <a
                    href={`${EXPLORER_URL}/tx/${event.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-gray-600 hover:text-gray-400 font-mono transition-colors"
                  >
                    tx: {truncateAddress(event.txHash, 4)}
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
