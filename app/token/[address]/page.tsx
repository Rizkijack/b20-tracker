"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useTokenDetail } from "@/hooks/useTokenDetail";
import { truncateAddress, formatAmount, isB20Address } from "@/lib/b20-client";
import {
  getEventBadgeColor,
  getEventIcon,
  getEventLabel,
  getEventDescription,
} from "@/lib/event-decoder";
import { EXPLORER_URL } from "@/lib/constants";

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

export default function TokenDetailPage() {
  const params = useParams();
  const address = (params.address as string)?.toLowerCase();
  const [activeTab, setActiveTab] = useState<"events" | "info">("events");

  const { metadata, events, loading, error } = useTokenDetail(address);

  // Error / invalid states
  if (!address) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0E17]">
        <div className="text-center glass-card p-8 max-w-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 mx-auto mb-4">
            <svg className="h-7 w-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm mb-1">No token address provided</p>
          <Link href="/" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!isB20Address(address)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0E17]">
        <div className="text-center glass-card p-8 max-w-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-500/10 mx-auto mb-4">
            <svg className="h-7 w-7 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
            </svg>
          </div>
          <p className="text-gray-300 text-sm mb-1 font-medium">Not a B20 token address</p>
          <p className="text-[11px] text-gray-600 font-mono mb-4 break-all">{address}</p>
          <Link href="/" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0B0E17]">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0B0E17]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-xs font-medium">Dashboard</span>
            </Link>
            <span className="text-gray-600 text-xs">/</span>
            <span className="text-xs text-gray-400 font-mono">
              {metadata ? metadata.symbol : truncateAddress(address, 6)}
            </span>
          </div>

          {/* Basescan Link */}
          <a
            href={`${EXPLORER_URL}/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] text-gray-400 hover:bg-white/[0.06] hover:text-white transition-all"
          >
            <span>Basescan</span>
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#3B82F6] border-t-transparent"></div>
            <p className="mt-4 text-sm text-gray-500 animate-fade-in">Loading token data...</p>
            <p className="text-xs text-gray-600 mt-1 animate-fade-in">Fetching on-chain metadata</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 mx-auto mb-4">
              <svg className="h-7 w-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm">{error}</p>
            <Link href="/" className="mt-4 text-sm text-blue-400 hover:text-blue-300 transition-colors">
              ← Back to Dashboard
            </Link>
          </div>
        ) : metadata ? (
          <>
            {/* Token Header Card */}
            <div className="glass-card p-5 mb-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className={`token-icon h-14 w-14 text-xl ${metadata.currency ? "token-icon-stablecoin" : "token-icon-asset"}`}>
                  {metadata.symbol.slice(0, 3)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-xl font-bold text-white">{metadata.name}</h1>
                    <span className="inline-flex items-center rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs font-mono font-medium text-gray-300 border border-white/[0.06]">
                      {metadata.symbol}
                    </span>
                    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                      metadata.currency ? "badge-green" : "badge-purple"
                    }`}>
                      {metadata.currency ? `${metadata.currency} Stablecoin` : "B20 Asset"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-mono text-gray-500 break-all">
                      {address}
                    </span>
                  </div>
                </div>
              </div>

              {/* Token Stats Grid */}
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">Total Supply</p>
                  <p className="mt-1.5 text-base font-bold text-white tabular-nums">
                    {formatAmount(metadata.totalSupply, metadata.decimals)}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5 font-mono">{metadata.decimals} decimals</p>
                </div>
                {metadata.currency ? (
                  <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">Currency</p>
                    <p className="mt-1.5 text-base font-bold text-white">{metadata.currency}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">Stablecoin peg</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">Decimals</p>
                    <p className="mt-1.5 text-base font-bold text-white tabular-nums">{metadata.decimals}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">Token precision</p>
                  </div>
                )}
                <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">Events</p>
                  <p className="mt-1.5 text-base font-bold text-white tabular-nums">{events.length}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">Recent activity</p>
                </div>
                <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">Variant</p>
                  <p className="mt-1.5 text-base font-bold text-white">
                    {metadata.currency ? "Stablecoin" : "Asset"}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5">B20 standard</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-4 border-b border-white/[0.06]">
              <button
                onClick={() => setActiveTab("events")}
                className={`px-4 py-2.5 text-xs font-semibold transition-colors relative ${
                  activeTab === "events"
                    ? "text-blue-400"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                Recent Activity
                {activeTab === "events" && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500 rounded-full"></span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("info")}
                className={`px-4 py-2.5 text-xs font-semibold transition-colors relative ${
                  activeTab === "info"
                    ? "text-blue-400"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                Info
                {activeTab === "info" && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500 rounded-full"></span>
                )}
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === "events" ? (
              <div className="glass-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                    </div>
                    <h2 className="text-sm font-semibold text-white">Activity History</h2>
                    <span className="inline-flex items-center justify-center rounded-full bg-[#3B82F6]/10 px-2 py-0.5 text-[11px] font-medium text-[#3B82F6]">
                      {events.length}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-[0.06em]">Live</span>
                </div>

                {events.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.03] mb-3">
                      <svg className="h-6 w-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-400">No events found in recent blocks</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Events will appear when transfers, mints, or burns occur
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]"
                      >
                        {/* Icon */}
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-[11px] shrink-0 mt-0.5">
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
                            <span className="text-xs text-gray-500">
                              {getEventDescription(event)}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 mt-1">
                            {event.amount && event.amount > BigInt(0) && (
                              <span className="text-xs font-mono text-gray-400 tabular-nums">
                                <span className={event.type === "mint" ? "text-green-400" : event.type === "burn" ? "text-red-400" : ""}>
                                  {event.type === "mint" ? "+" : event.type === "burn" ? "-" : ""}
                                  {formatAmount(event.amount, metadata.decimals)}
                                </span>
                              </span>
                            )}
                            <span className="text-[10px] text-gray-600 font-mono tabular-nums" title={formatTime(event.timestamp)}>
                              {formatTime(event.timestamp)}
                            </span>
                            <a
                              href={`${EXPLORER_URL}/tx/${event.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-gray-600 hover:text-blue-400 font-mono transition-colors"
                            >
                              {truncateAddress(event.txHash, 6)}
                            </a>
                            <span className="text-[10px] text-gray-600 font-mono">
                              #{event.blockNumber}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Info Tab */
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Token Information</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-white/[0.04]">
                    <span className="text-xs text-gray-500">Name</span>
                    <span className="text-xs text-white font-medium">{metadata.name}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/[0.04]">
                    <span className="text-xs text-gray-500">Symbol</span>
                    <span className="text-xs text-white font-mono font-medium">{metadata.symbol}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/[0.04]">
                    <span className="text-xs text-gray-500">Variant</span>
                    <span className={`text-xs font-medium ${metadata.currency ? "text-green-400" : "text-purple-400"}`}>
                      {metadata.currency ? `${metadata.currency} Stablecoin` : "Asset"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/[0.04]">
                    <span className="text-xs text-gray-500">Decimals</span>
                    <span className="text-xs text-white font-mono">{metadata.decimals}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/[0.04]">
                    <span className="text-xs text-gray-500">Total Supply</span>
                    <span className="text-xs text-white font-mono tabular-nums">
                      {formatAmount(metadata.totalSupply, metadata.decimals)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/[0.04]">
                    <span className="text-xs text-gray-500">Contract Address</span>
                    <a
                      href={`${EXPLORER_URL}/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 font-mono hover:text-blue-300 transition-colors truncate ml-4"
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
