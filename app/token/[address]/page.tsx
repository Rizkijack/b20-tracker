"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useTokenDetail } from "@/hooks/useTokenDetail";
import { truncateAddress, formatAmount, isB20Address } from "@/lib/b20-client";
import {
  getEventBadgeColor,
  getEventIcon,
  getEventLabel,
  getEventDescription,
} from "@/lib/event-decoder";
import { EXPLORER_URL } from "@/lib/constants";

export default function TokenDetailPage() {
  const params = useParams();
  const address = (params.address as string)?.toLowerCase();

  const { metadata, events, loading, error } = useTokenDetail(address);

  const formatTime = (timestamp: number) => {
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
  };

  if (!address) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0D0D0D]">
        <div className="text-center">
          <p className="text-4xl mb-3">❌</p>
          <p className="text-gray-400">No token address provided</p>
          <Link href="/" className="mt-4 inline-block text-[#0052FF] hover:underline text-sm">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!isB20Address(address)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0D0D0D]">
        <div className="text-center">
          <p className="text-4xl mb-3">⚠️</p>
          <p className="text-gray-400 mb-1">Not a B20 token address</p>
          <p className="text-xs text-gray-600 font-mono mb-4">{address}</p>
          <Link href="/" className="inline-block text-[#0052FF] hover:underline text-sm">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0D0D0D]">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0D0D0D]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm">Dashboard</span>
            </Link>
            <span className="text-gray-600">/</span>
            <span className="text-sm text-gray-400 font-mono">
              {truncateAddress(address, 8)}
            </span>
          </div>

          <a
            href={`${EXPLORER_URL}/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-400 hover:bg-white/10 hover:text-white transition-all"
          >
            <span>Basescan</span>
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#0052FF] border-t-transparent"></div>
            <p className="mt-4 text-sm text-gray-500">Loading token data...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="text-gray-400">{error}</p>
            <Link href="/" className="mt-4 inline-block text-[#0052FF] hover:underline text-sm">
              ← Back to Dashboard
            </Link>
          </div>
        ) : metadata ? (
          <>
            {/* Token Header */}
            <div className="mb-8 rounded-xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0052FF]/20 text-2xl font-bold text-[#0052FF] border border-[#0052FF]/30">
                  {metadata.symbol.slice(0, 4)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl font-bold text-white">{metadata.name}</h1>
                    <span className="rounded-lg bg-white/10 px-2.5 py-1 text-sm font-medium text-gray-300">
                      {metadata.symbol}
                    </span>
                    <span className="rounded-lg bg-[#0052FF]/20 px-2.5 py-1 text-xs font-medium text-[#0052FF] border border-[#0052FF]/30">
                      B20 {metadata.currency ? `Stablecoin (${metadata.currency})` : "Asset"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-4 flex-wrap">
                    <a
                      href={`${EXPLORER_URL}/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {address}
                    </a>
                  </div>
                </div>
              </div>

              {/* Token Stats Grid */}
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Total Supply</p>
                  <p className="mt-1 text-lg font-bold text-white tabular-nums">
                    {formatAmount(metadata.totalSupply, metadata.decimals)}
                  </p>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Decimals</p>
                  <p className="mt-1 text-lg font-bold text-white tabular-nums">{metadata.decimals}</p>
                </div>
                {metadata.currency && (
                  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Currency</p>
                    <p className="mt-1 text-lg font-bold text-white">{metadata.currency}</p>
                  </div>
                )}
                <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Events Tracked</p>
                  <p className="mt-1 text-lg font-bold text-white tabular-nums">{events.length}</p>
                </div>
              </div>
            </div>

            {/* Event History */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
                <h2 className="text-sm font-semibold text-white">
                  Recent Activity
                  <span className="ml-2 rounded-full bg-[#0052FF]/20 px-2 py-0.5 text-xs text-[#0052FF]">
                    {events.length}
                  </span>
                </h2>
                <div className="flex items-center gap-2">
                  <div className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                  </div>
                  <span className="text-xs text-gray-500">Live updates</span>
                </div>
              </div>

              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="text-4xl mb-3">📭</div>
                  <p className="text-gray-400 text-sm">No events found in recent blocks</p>
                  <p className="text-gray-600 text-xs mt-1">
                    Events will appear here when transfers, mints, or burns occur
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-4 px-5 py-3 hover:bg-white/[0.03] transition-all"
                    >
                      {/* Icon */}
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-sm mt-0.5">
                        {getEventIcon(event.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getEventBadgeColor(
                              event.type
                            )}`}
                          >
                            {getEventLabel(event.type)}
                          </span>
                          <span className="text-xs text-gray-400">
                            {getEventDescription(event)}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 mt-1">
                          {event.amount && event.amount > BigInt(0) && (
                            <span className="text-xs font-mono text-gray-300">
                              {event.type === "mint"
                                ? "+"
                                : event.type === "burn"
                                ? "-"
                                : ""}
                              {formatAmount(event.amount, metadata.decimals)}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-600 tabular-nums">
                            {formatTime(event.timestamp)}
                          </span>
                          <a
                            href={`${EXPLORER_URL}/tx/${event.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-gray-600 hover:text-gray-400 font-mono transition-colors"
                          >
                            {truncateAddress(event.txHash, 6)}
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
