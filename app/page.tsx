"use client";

import { useState } from "react";
import Header from "@/components/Header";
import StatsBar from "@/components/StatsBar";
import TokenList from "@/components/TokenList";
import LiveEventFeed from "@/components/LiveEventFeed";
import SidebarWidgets from "@/components/SidebarWidgets";
import { useB20Tokens } from "@/hooks/useB20Tokens";
import { useB20Events } from "@/hooks/useB20Events";
import { useStats } from "@/hooks/useStats";

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { tokens, loading: tokensLoading, error: tokensError, currentBlock: tokenBlock } = useB20Tokens();
  const { events, loading: eventsLoading, error: eventsError, currentBlock: eventBlock } = useB20Events();

  const { stats, blockHeight } = useStats(tokens);

  const latestBlock = Math.max(tokenBlock, eventBlock);

  const showError = tokensError || eventsError;
  const isInitialLoad = tokensLoading && tokens.length === 0;
  const isEventsLoading = eventsLoading && events.length === 0;

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: "var(--bg-body)" }}>
      <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6">
        {/* Hero Section */}
        <div className="mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white font-bold text-xs shadow-lg shadow-blue-500/20" aria-hidden="true">
              B20
            </div>
            <div>
              <h2 className="text-lg font-bold sm:text-xl tracking-tight" style={{ color: "var(--text-primary)" }}>
                B20 Token <span style={{ color: "var(--accent-blue)" }}>Dashboard</span>
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                Real-time tracker for Base&apos;s native token standard
              </p>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="mb-5">
          <StatsBar stats={stats} blockHeight={latestBlock} />
        </div>

        {/* Error Banner */}
        {showError && (
          <div className="mb-5 rounded-xl px-4 py-3" style={{ border: "1px solid var(--accent-red-dim)", backgroundColor: "var(--accent-red-dim)" }}>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/10">
                <svg className="h-3 w-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <p className="text-sm" style={{ color: "var(--accent-red)" }}>
                Connection issues detected. Retrying...
              </p>
            </div>
            {tokensError && (
              <p className="text-xs mt-1 ml-8" style={{ color: "var(--accent-red)" }}>{tokensError}</p>
            )}
          </div>
        )}

        {/* Three-column layout: 2/12 - 7/12 - 3/12 */}
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Left: Token List - 2 columns */}
          <div className="lg:col-span-3 xl:col-span-2">
            {isInitialLoad ? (
              <div className="glass-card flex flex-col items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#3B82F6] border-t-transparent" role="status" aria-label="Loading tokens"></div>
                <p className="mt-4 text-sm animate-fade-in" style={{ color: "var(--text-tertiary)" }}>
                  Scanning Base Mainnet
                </p>
                <p className="text-xs mt-1 animate-fade-in" style={{ color: "var(--text-muted)" }}>
                  Searching for B20-prefixed addresses
                </p>
              </div>
            ) : (
              <TokenList tokens={tokens} searchQuery={searchQuery} />
            )}
          </div>

          {/* Center: Live Event Feed - 7 columns on xl, 6 on lg */}
          <div className="lg:col-span-6 xl:col-span-7">
            {isEventsLoading ? (
              <div className="glass-card flex flex-col items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-green)] border-t-transparent" role="status" aria-label="Loading events"></div>
                <p className="mt-4 text-sm animate-fade-in" style={{ color: "var(--text-tertiary)" }}>
                  Connecting to Base Mainnet
                </p>
                <p className="text-xs mt-1 animate-fade-in" style={{ color: "var(--text-muted)" }}>
                  Listening for B20 Transfer events
                </p>
              </div>
            ) : (
              <LiveEventFeed events={events} />
            )}
          </div>

          {/* Right: Sidebar Widgets - 3 columns */}
          <div className="lg:col-span-3">
            {tokens.length > 0 || events.length > 0 ? (
              <SidebarWidgets events={events} tokens={tokens} />
            ) : isInitialLoad && isEventsLoading ? (
              <div className="glass-card flex flex-col items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#A855F7] border-t-transparent" role="status" aria-label="Loading"></div>
                <p className="mt-3 text-xs animate-fade-in" style={{ color: "var(--text-tertiary)" }}>
                  Loading widgets...
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 border-t pt-5 pb-4" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-[11px]" style={{ color: "var(--text-muted)" }}>
              <span>Powered by Base RPC</span>
              <span style={{ color: "var(--border-default)" }}>|</span>
              <a
                href="https://docs.base.org/base-chain/specs/upgrades/beryl/b20"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:opacity-80"
                style={{ color: "var(--accent-blue)" }}
              >
                B20 Protocol
              </a>
              <span style={{ color: "var(--border-default)" }}>|</span>
              <a
                href="https://github.com/base/base-std"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:opacity-80"
                style={{ color: "var(--accent-blue)" }}
              >
                base-std
              </a>
            </div>
            <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
              <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500"></span>
              </span>
              Polling every 4s
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
