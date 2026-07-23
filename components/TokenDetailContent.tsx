"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import type { B20Event, B20EventType } from "@/lib/types";
import { truncateAddress, formatAmount, isB20Address } from "@/lib/b20-client";
import {
  getEventBadgeColor,
  getEventIcon,
  getEventLabel,
  getEventDescription,
  decodeTransferEvent,
} from "@/lib/event-decoder";
import { EXPLORER_URL } from "@/lib/constants";
import { fetchTokenMetadata, fetchTokenEvents, getBlockTimestamp, getCurrentBlockNumber } from "@/lib/api-client";
import ChartSection from "@/components/ChartSection";

// Internal type for client-side metadata (totalSupply as bigint)
interface TokenMeta {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  currency?: string;
}

// Server passes BigInt values as strings (RSC serialization safe)
interface ServerTokenMeta {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  currency?: string;
}

interface ServerEvent {
  id: string;
  type: string;
  from: string;
  to: string;
  tokenAddress: string;
  amount: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  timestamp: number;
}

function convertMetadata(meta: ServerTokenMeta): TokenMeta {
  return {
    ...meta,
    totalSupply: BigInt(meta.totalSupply || "0"),
  };
}

function convertEvents(evts: ServerEvent[]): B20Event[] {
  return evts.map((e) => ({
    ...e,
    type: e.type as B20EventType,
    amount: BigInt(e.amount || "0"),
  }));
}

interface TokenDetailContentProps {
  address: string;
  initialMetadata: ServerTokenMeta | null;
  initialEvents: ServerEvent[];
}

function formatTime(timestamp: number): string {
  if (!timestamp) return "...";
  const date = new Date(timestamp * 1000);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function TokenDetailContent({
  address,
  initialMetadata,
  initialEvents,
}: TokenDetailContentProps) {
  const [activeTab, setActiveTab] = useState<"events" | "chart" | "info">("events");
  const [metadata, setMetadata] = useState<TokenMeta | null>(
    initialMetadata ? convertMetadata(initialMetadata) : null
  );
  const [events, setEvents] = useState<B20Event[]>(
    convertEvents(initialEvents)
  );
  const [loading, setLoading] = useState(!initialMetadata);
  const [error, setError] = useState<string | null>(null);
  const eventsRef = useRef<B20Event[]>(convertEvents(initialEvents));

  // Poll for live updates (every 5s)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const currentBlock = await getCurrentBlockNumber();
        const lastEventBlock = eventsRef.current.length > 0 ? eventsRef.current[0].blockNumber : currentBlock - 10;

        const [meta, logs] = await Promise.all([
          fetchTokenMetadata(address).catch(() => null),
          fetchTokenEvents(address, lastEventBlock + 1, currentBlock).catch(() => []),
        ]);

        if (meta) setMetadata((prev) => prev && meta.totalSupply === prev.totalSupply ? prev : meta);

        const newDecoded: B20Event[] = [];
        for (const log of logs) {
          const event = decodeTransferEvent({
            topics: log.topics,
            data: log.data,
            blockNumber: log.blockNumber,
            txHash: log.txHash,
            logIndex: log.logIndex,
            address,
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
          const merged = [...newDecoded.reverse(), ...eventsRef.current].slice(0, 100);
          eventsRef.current = merged;
          setEvents(merged);
        }
      } catch {
        // ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [address]);

  async function fetchDetail() {
    try {
      setLoading(true);
      const currentBlock = await getCurrentBlockNumber();
      const [meta, logs] = await Promise.all([
        fetchTokenMetadata(address).catch(() => null),
        fetchTokenEvents(address, currentBlock - 5000, currentBlock).catch(() => []),
      ]);

      if (meta) setMetadata(meta);

      const decoded: B20Event[] = [];
      for (const log of logs) {
        const event = decodeTransferEvent({
          topics: log.topics,
          data: log.data,
          blockNumber: log.blockNumber,
          txHash: log.txHash,
          logIndex: log.logIndex,
          address,
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

      decoded.sort((a, b) => b.blockNumber - a.blockNumber);
      eventsRef.current = decoded.slice(0, 100);
      setEvents(eventsRef.current);
      setError(null);
    } catch (err) {
      console.error("Error fetching token detail:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch token detail");
    } finally {
      setLoading(false);
    }
  }

  // Error / invalid states
  if (!address) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--bg-body)" }}>
        <div className="text-center glass-card p-8 max-w-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 mx-auto mb-4">
            <svg className="h-7 w-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>No token address provided</p>
          <Link href="/" className="text-sm transition-colors" style={{ color: "var(--accent-blue)" }}>
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!isB20Address(address)) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--bg-body)" }}>
        <div className="text-center glass-card p-8 max-w-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-500/10 mx-auto mb-4">
            <svg className="h-7 w-7 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
            </svg>
          </div>
          <p className="text-sm mb-1 font-medium" style={{ color: "var(--text-primary)" }}>Not a B20 token address</p>
          <p className="text-[11px] font-mono mb-4 break-all" style={{ color: "var(--text-muted)" }}>{address}</p>
          <Link href="/" className="text-sm transition-colors" style={{ color: "var(--accent-blue)" }}>
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: "var(--bg-body)" }}>
      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b backdrop-blur-xl" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-body)" }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/50"
              style={{ color: "var(--text-tertiary)" }}
              aria-label="Back to Dashboard"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Dashboard</span>
            </Link>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>/</span>
            <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
              {metadata ? metadata.symbol : truncateAddress(address, 6)}
            </span>
          </div>

          {/* Basescan Link */}
          <a
            href={`${EXPLORER_URL}/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/50"
            style={{ color: "var(--text-tertiary)", border: "1px solid var(--border-default)", backgroundColor: "rgba(255,255,255,0.03)" }}
            aria-label={`View contract on Basescan`}
          >
            <span>Basescan</span>
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6" aria-label="Token detail content">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#3B82F6] border-t-transparent" role="status" aria-label="Loading"></div>
            <p className="mt-4 text-sm animate-fade-in" style={{ color: "var(--text-tertiary)" }}>Loading token data...</p>
            <p className="text-xs mt-1 animate-fade-in" style={{ color: "var(--text-muted)" }}>Fetching on-chain metadata</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 mx-auto mb-4">
              <svg className="h-7 w-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
              </svg>
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{error}</p>
            <Link href="/" className="mt-4 text-sm transition-colors" style={{ color: "var(--accent-blue)" }}>
              ← Back to Dashboard
            </Link>
          </div>
        ) : metadata ? (
          <>
            {/* Token Header Card */}
            <div className="glass-card p-5 mb-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className={`token-icon h-14 w-14 text-xl ${metadata.currency ? "token-icon-stablecoin" : "token-icon-asset"}`} aria-hidden="true">
                  {metadata.symbol.slice(0, 3)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{metadata.name}</h1>
                    <span className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-mono font-medium" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
                      {metadata.symbol}
                    </span>
                    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold ${metadata.currency ? "badge-green" : "badge-purple"}`}>
                      {metadata.currency ? `${metadata.currency} Stablecoin` : "B20 Asset"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-mono break-all" style={{ color: "var(--text-tertiary)" }}>
                      {address}
                    </span>
                  </div>
                </div>
              </div>

              {/* Token Stats Grid */}
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg p-3.5" style={{ border: "1px solid var(--border-subtle)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-tertiary)" }}>Total Supply</p>
                  <p className="mt-1.5 text-base font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                    {formatAmount(metadata.totalSupply, metadata.decimals)}
                  </p>
                  <p className="text-[10px] mt-0.5 font-mono" style={{ color: "var(--text-muted)" }}>{metadata.decimals} decimals</p>
                </div>
                {metadata.currency ? (
                  <div className="rounded-lg p-3.5" style={{ border: "1px solid var(--border-subtle)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-tertiary)" }}>Currency</p>
                    <p className="mt-1.5 text-base font-bold" style={{ color: "var(--text-primary)" }}>{metadata.currency}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Stablecoin peg</p>
                  </div>
                ) : (
                  <div className="rounded-lg p-3.5" style={{ border: "1px solid var(--border-subtle)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-tertiary)" }}>Decimals</p>
                    <p className="mt-1.5 text-base font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{metadata.decimals}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Token precision</p>
                  </div>
                )}
                <div className="rounded-lg p-3.5" style={{ border: "1px solid var(--border-subtle)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-tertiary)" }}>Events</p>
                  <p className="mt-1.5 text-base font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{events.length}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Recent activity</p>
                </div>
                <div className="rounded-lg p-3.5" style={{ border: "1px solid var(--border-subtle)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-tertiary)" }}>Variant</p>
                  <p className="mt-1.5 text-base font-bold" style={{ color: "var(--text-primary)" }}>
                    {metadata.currency ? "Stablecoin" : "Asset"}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>B20 standard</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-4 border-b" style={{ borderColor: "var(--border-subtle)" }} role="tablist" aria-label="Token information tabs">
              <button
                onClick={() => setActiveTab("events")}
                className={`px-4 py-2.5 text-xs font-semibold transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/50`}
                style={{ color: activeTab === "events" ? "var(--accent-blue)" : "var(--text-tertiary)" }}
                role="tab"
                aria-selected={activeTab === "events"}
                aria-controls="events-tab-panel"
                id="events-tab"
              >
                Recent Activity
                {activeTab === "events" && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full" style={{ backgroundColor: "var(--accent-blue)" }}></span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("chart")}
                className={`px-4 py-2.5 text-xs font-semibold transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/50`}
                style={{ color: activeTab === "chart" ? "var(--accent-blue)" : "var(--text-tertiary)" }}
                role="tab"
                aria-selected={activeTab === "chart"}
                aria-controls="chart-tab-panel"
                id="chart-tab"
              >
                Price Chart
                {activeTab === "chart" && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full" style={{ backgroundColor: "var(--accent-blue)" }}></span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("info")}
                className={`px-4 py-2.5 text-xs font-semibold transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/50`}
                style={{ color: activeTab === "info" ? "var(--accent-blue)" : "var(--text-tertiary)" }}
                role="tab"
                aria-selected={activeTab === "info"}
                aria-controls="info-tab-panel"
                id="info-tab"
              >
                Info
                {activeTab === "info" && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full" style={{ backgroundColor: "var(--accent-blue)" }}></span>
                )}
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === "events" && (
              <div className="glass-card overflow-hidden" role="tabpanel" id="events-tab-panel" aria-labelledby="events-tab">
                <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border-subtle)" }}>
                  <div className="flex items-center gap-2.5">
                    <div className="relative flex h-2 w-2" aria-hidden="true">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                    </div>
                    <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Activity History</h2>
                    <span className="badge-blue">{events.length}</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.06em]" style={{ color: "var(--text-tertiary)" }}>Live</span>
                </div>

                {events.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.03] mb-3">
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" style={{ color: "var(--text-muted)" }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                    </div>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No events found in recent blocks</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      Events will appear when transfers, mints, or burns occur
                    </p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }} role="log" aria-label="Token event history">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start gap-3 px-4 py-3 transition-colors"
                        style={{ borderColor: "var(--border-subtle)" }}
                        role="article"
                        aria-label={`${getEventLabel(event.type)} event`}
                      >
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
                            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                              {getEventDescription(event)}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 mt-1">
                            {event.amount && event.amount > BigInt(0) && (
                              <span className="text-xs font-mono tabular-nums" style={{ color: "var(--text-secondary)" }}>
                                <span className={event.type === "mint" ? "text-[var(--accent-green)]" : event.type === "burn" ? "text-[var(--accent-red)]" : ""}>
                                  {event.type === "mint" ? "+" : event.type === "burn" ? "-" : ""}
                                  {formatAmount(event.amount, metadata.decimals)}
                                </span>
                              </span>
                            )}
                            <span className="text-[10px] font-mono tabular-nums" style={{ color: "var(--text-muted)" }} title={formatTime(event.timestamp)}>
                              {formatTime(event.timestamp)}
                            </span>
                            <a
                              href={`${EXPLORER_URL}/tx/${event.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/50"
                              style={{ color: "var(--text-muted)" }}
                              aria-label={`View transaction ${truncateAddress(event.txHash, 6)} on Basescan`}
                            >
                              {truncateAddress(event.txHash, 6)}
                            </a>
                            <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                              #{event.blockNumber}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {activeTab === "chart" && (
              <div role="tabpanel" id="chart-tab-panel" aria-labelledby="chart-tab">
                {metadata.currency ? (
                  <div className="glass-card p-5 text-center">
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Price chart not available for stablecoins</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Stablecoin price is pegged to {metadata.currency}</p>
                  </div>
                ) : (
                  <ChartSection
                    address={address}
                    symbol={metadata?.symbol}
                  />
                )}
              </div>
            )}
            {activeTab === "info" && (
              /* Info Tab */
              <div className="glass-card p-5" role="tabpanel" id="info-tab-panel" aria-labelledby="info-tab">
                <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Token Information</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                    <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Name</span>
                    <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{metadata.name}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                    <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Symbol</span>
                    <span className="text-xs font-mono font-medium" style={{ color: "var(--text-primary)" }}>{metadata.symbol}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                    <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Variant</span>
                    <span className="text-xs font-medium" style={{ color: metadata.currency ? "var(--accent-green)" : "var(--accent-purple)" }}>
                      {metadata.currency ? `${metadata.currency} Stablecoin` : "Asset"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                    <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Decimals</span>
                    <span className="text-xs font-mono" style={{ color: "var(--text-primary)" }}>{metadata.decimals}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                    <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Total Supply</span>
                    <span className="text-xs font-mono tabular-nums" style={{ color: "var(--text-primary)" }}>
                      {formatAmount(metadata.totalSupply, metadata.decimals)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                    <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Contract Address</span>
                    <a
                      href={`${EXPLORER_URL}/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono hover:opacity-80 transition-opacity truncate ml-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/50"
                      style={{ color: "var(--accent-blue)" }}
                    >
                      {truncateAddress(address, 10)}
                    </a>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}


