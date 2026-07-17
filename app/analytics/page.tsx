"use client";

import Link from "next/link";
import Header from "@/components/Header";
import ActivityChart from "@/components/ActivityChart";
import MintBurnChart from "@/components/MintBurnChart";
import VariantDistribution from "@/components/VariantDistribution";
import Leaderboard from "@/components/Leaderboard";
import { useB20Tokens } from "@/hooks/useB20Tokens";
import { useB20Events } from "@/hooks/useB20Events";
import { useAnalytics } from "@/hooks/useAnalytics";

export default function AnalyticsPage() {
  const { tokens, loading: tokensLoading, error: tokensError } = useB20Tokens();
  const { events, loading: eventsLoading, error: eventsError } = useB20Events();
  const analytics = useAnalytics(events, tokens);

  const isLoading = tokensLoading || eventsLoading;
  const hasError = tokensError || eventsError;

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: "var(--bg-body)" }}>
      <Header searchQuery="" onSearchChange={() => {}} />

      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6" aria-label="Analytics dashboard content">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-5">
          <Link href="/" className="text-xs text-gray-500 hover:text-white transition-colors">
            Dashboard
          </Link>
          <svg className="h-3 w-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-xs text-gray-400">Analytics</span>
        </div>

        {/* Page Header */}
        <div className="mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 text-white font-bold text-xs shadow-lg shadow-purple-500/20">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white sm:text-xl tracking-tight">
                Analytics <span className="text-blue-400">Dashboard</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                On-chain activity statistics and insights
              </p>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && tokens.length === 0 && events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#3B82F6] border-t-transparent"></div>
            <p className="mt-4 text-sm text-gray-500 animate-fade-in">
              Computing analytics...
            </p>
          </div>
        ) : hasError ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="text-sm text-red-400">
                Connection issues detected. Data may be incomplete.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="glass-card p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10">
                    <svg className="h-3 w-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">
                    24h Events
                  </span>
                </div>
                <p className="text-xl font-bold text-white tabular-nums">{analytics.totalEvents24h}</p>
                <p className="text-[10px] text-blue-400/60 mt-0.5">total activity</p>
              </div>

              <div className="glass-card p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-green-500/10">
                    <svg className="h-3 w-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">
                    24h Mints
                  </span>
                </div>
                <p className="text-xl font-bold text-white tabular-nums">{analytics.totalMints24h}</p>
                <p className="text-[10px] text-green-400/60 mt-0.5">new tokens minted</p>
              </div>

              <div className="glass-card p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500/10">
                    <svg className="h-3 w-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">
                    24h Burns
                  </span>
                </div>
                <p className="text-xl font-bold text-white tabular-nums">{analytics.totalBurns24h}</p>
                <p className="text-[10px] text-red-400/60 mt-0.5">tokens burned</p>
              </div>

              <div className="glass-card p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-500/10">
                    <svg className="h-3 w-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">
                    Active Tokens
                  </span>
                </div>
                <p className="text-xl font-bold text-white tabular-nums">{analytics.uniqueTokens24h}</p>
                <p className="text-[10px] text-purple-400/60 mt-0.5">unique in 24h</p>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid gap-5 lg:grid-cols-2 mb-5">
              <ActivityChart data={analytics.hourlyActivity} />
              <MintBurnChart data={analytics.dailyMintBurn} />
            </div>

            {/* Distribution + Leaderboard Row */}
            <div className="grid gap-5 lg:grid-cols-3 mb-5">
              <div className="lg:col-span-1">
                <VariantDistribution
                  data={analytics.variantDistribution}
                  totalTokens={tokens.length}
                />
              </div>
              <div className="lg:col-span-2">
                <Leaderboard data={analytics.mostActiveTokens} />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
