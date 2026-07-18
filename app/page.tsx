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
    <div className="flex min-h-screen flex-col bg-background relative selection:bg-[#0052FF]/30">
      {/* Background ambient glow */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#0052FF]/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 blur-[120px]" />
      </div>

      {/* Header */}
      <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      {/* Main Content */}
      <main className="relative z-10 mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            B20 Token <span className="gradient-text">Dashboard</span>
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Real-time tracker for Base&apos;s native token standard
          </p>
        </div>

        {/* Stats Bar */}
        <div className="mb-6">
          <StatsBar stats={stats} blockHeight={latestBlock} />
        </div>

        {/* Error Banner */}
        {(tokensError || eventsError) && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3">
            <p className="text-sm text-red-400">
              ⚠️ Connection issues detected. Retrying...
            </p>
            {tokensError && (
              <p className="text-xs text-red-400/60 mt-1">{tokensError}</p>
            )}
          </div>
        )}

        {/* Two-column layout: Token List + Live Feed */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Token List - 2 columns */}
          <div className="lg:col-span-2">
            {tokensLoading && tokens.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-white/10 bg-white/[0.03]">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0052FF] border-t-transparent"></div>
                <p className="mt-3 text-sm text-gray-500">Scanning Base Mainnet for B20 tokens...</p>
                <p className="text-xs text-gray-600 mt-1">Checking recent blocks for B20-prefixed addresses</p>
              </div>
            ) : (
              <TokenList tokens={tokens} searchQuery={searchQuery} />
            )}
          </div>

          {/* Live Event Feed - 3 columns */}
          <div className="lg:col-span-3">
            {eventsLoading && events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-white/10 bg-white/[0.03]">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-500 border-t-transparent"></div>
                <p className="mt-3 text-sm text-gray-500">Connecting to Base Mainnet...</p>
                <p className="text-xs text-gray-600 mt-1">Listening for B20 Transfer events</p>
              </div>
            ) : (
              <LiveEventFeed events={events} />
            )}
          </div>
        </div>

        {/* Footer Info */}
        <footer className="mt-8 border-t border-white/5 pt-6 pb-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <span>Powered by Base RPC</span>
              <span>•</span>
              <a
                href="https://docs.base.org/base-chain/specs/upgrades/beryl/b20"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0052FF] hover:text-[#0052FF]/80 transition-colors"
              >
                B20 Protocol Spec
              </a>
              <span>•</span>
              <a
                href="https://github.com/base/base-std"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0052FF] hover:text-[#0052FF]/80 transition-colors"
              >
                base-std
              </a>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <div className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500"></span>
              </div>
              Polling Base Mainnet every 4 seconds
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
