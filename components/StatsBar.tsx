"use client";

import type { B20Stats } from "@/lib/types";

interface StatsBarProps {
  stats: B20Stats;
  blockHeight: number;
}

export default function StatsBar({ stats, blockHeight }: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {/* Total Tokens */}
      <div className="glass-card group p-3.5">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#3B82F6]/10">
            <svg className="h-3 w-3 text-[#3B82F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">
            Total Tokens
          </span>
        </div>
        <p className="text-xl font-bold text-white tabular-nums tracking-tight">
          {stats.totalTokens}
        </p>
      </div>

      {/* Assets */}
      <div className="glass-card group p-3.5">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-500/10">
            <svg className="h-3 w-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">
            Assets
          </span>
        </div>
        <p className="text-xl font-bold text-white tabular-nums tracking-tight">
          {stats.totalAssetTokens}
        </p>
      </div>

      {/* Stablecoins */}
      <div className="glass-card group p-3.5">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-green-500/10">
            <svg className="h-3 w-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">
            Stablecoins
          </span>
        </div>
        <p className="text-xl font-bold text-white tabular-nums tracking-tight">
          {stats.totalStablecoinTokens}
        </p>
      </div>

      {/* Block Height */}
      <div className="glass-card group p-3.5">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/10">
            <svg className="h-3 w-3 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">
            Block Height
          </span>
        </div>
        <p className="text-xl font-bold text-white tabular-nums tracking-tight">
          {blockHeight.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
