"use client";

import { useState } from "react";
import Header from "@/components/Header";
import StatsBar from "@/components/StatsBar";
import TokenList from "@/components/TokenList";
import LiveEventFeed from "@/components/LiveEventFeed";
import { useB20Tokens } from "@/hooks/useB20Tokens";
import { useB20Events } from "@/hooks/useB20Events";
import { useStats } from "@/hooks/useStats";

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { tokens, loading: tokensLoading, error: tokensError, currentBlock: tokenBlock } = useB20Tokens();
  const { events, loading: eventsLoading, error: eventsError, currentBlock: eventBlock } = useB20Events();

  const { stats, blockHeight } = useStats(tokens);

  const latestBlock = Math.max(tokenBlock, eventBlock);

  return (
    <div className="flex min-h-screen flex-col bg-[#0B0E17]">
      <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6">
        {/* Hero Section */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white font-bold text-xs shadow-lg shadow-blue-500/20">
              B20
            </div>
            <div>
              <h2 className="text-lg font-bold text-white sm:text-xl tracking-tight">
                B20 Token <span className="text-blue-400">Dashboard</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
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
        {(tokensError || eventsError) && (
          <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/10">
                <svg className="h-3 w-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <p className="text-sm text-red-400">
                Connection issues detected. Retrying...
              </p>
            </div>
            {tokensError && (
              <p className="text-xs text-red-400/60 mt-1 ml-8">{tokensError}</p>
            )}
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid gap-5 lg:grid-cols-5">
          {/* Token List */}
          <div className="lg:col-span-2">
            {tokensLoading && tokens.length === 0 ? (
              <div className="glass-card flex flex-col items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#3B82F6] border-t-transparent"></div>
                <p className="mt-4 text-sm text-gray-500 animate-fade-in">
                  Scanning Base Mainnet
                </p>
                <p className="text-xs text-gray-600 mt-1 animate-fade-in">
                  Searching for B20-prefixed token addresses
                </p>
              </div>
            ) : (
              <TokenList tokens={tokens} searchQuery={searchQuery} />
            )}
          </div>

          {/* Live Event Feed */}
          <div className="lg:col-span-3">
            {eventsLoading && events.length === 0 ? (
              <div className="glass-card flex flex-col items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-500 border-t-transparent"></div>
                <p className="mt-4 text-sm text-gray-500 animate-fade-in">
                  Connecting to Base Mainnet
                </p>
                <p className="text-xs text-gray-600 mt-1 animate-fade-in">
                  Listening for B20 Transfer events
                </p>
              </div>
            ) : (
              <LiveEventFeed events={events} />
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 border-t border-white/[0.06] pt-5 pb-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-[11px] text-gray-600">
              <span>Powered by Base RPC</span>
              <span className="text-white/[0.06]">|</span>
              <a
                href="https://docs.base.org/base-chain/specs/upgrades/beryl/b20"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                B20 Protocol
              </a>
              <span className="text-white/[0.06]">|</span>
              <a
                href="https://github.com/base/base-std"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                base-std
              </a>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-gray-600">
              <span className="relative flex h-1.5 w-1.5">
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
