"use client";

import Link from "next/link";
import type { TokenActivity } from "@/lib/analytics";
import { truncateAddress } from "@/lib/b20-client";
import { EXPLORER_URL } from "@/lib/constants";

interface LeaderboardProps {
  data: TokenActivity[];
}

function formatTimeAgo(timestamp: number): string {
  if (!timestamp) return "";
  const diff = Math.floor(Date.now() / 1000) - timestamp;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Leaderboard({ data }: LeaderboardProps) {
  if (data.length === 0) {
    return (
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-white mb-1">Most Active Tokens</h3>
        <p className="text-[10px] text-gray-500 mb-4">
          Top tokens by on-chain activity in 24h
        </p>
        <div className="flex flex-col items-center justify-center py-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.03] mb-2">
            <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <p className="text-xs text-gray-500">No activity in the last 24 hours</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-white">Most Active Tokens</h3>
        <p className="text-[10px] text-gray-500 mt-0.5">
          Top tokens by on-chain activity in 24h
        </p>
      </div>

      {/* Table header */}
      <div className="hidden sm:grid sm:grid-cols-[24px_1fr_80px_80px_80px_80px_80px] gap-2 px-5 py-2 border-t border-white/[0.06]">
        <span className="table-header">#</span>
        <span className="table-header">Token</span>
        <span className="table-header text-right">Activity</span>
        <span className="table-header text-right">Transfers</span>
        <span className="table-header text-right">Mints</span>
        <span className="table-header text-right">Burns</span>
        <span className="table-header text-right">Last</span>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {data.map((token, index) => (
          <Link
            key={token.address}
            href={`/token/${token.address}`}
            className="table-row block sm:grid sm:grid-cols-[24px_1fr_80px_80px_80px_80px_80px] sm:gap-2 px-5 py-3"
          >
            {/* Rank */}
            <div className="hidden sm:flex items-center">
              <span className={`text-xs font-bold tabular-nums ${
                index === 0 ? "text-yellow-500" :
                index === 1 ? "text-gray-300" :
                index === 2 ? "text-amber-600" :
                "text-gray-600"
              }`}>
                #{index + 1}
              </span>
            </div>

            {/* Token info */}
            <div className="flex items-center gap-2.5 mb-1 sm:mb-0">
              <div className={`token-icon h-8 w-8 text-[10px] ${
                token.variant === "stablecoin" ? "token-icon-stablecoin" : "token-icon-asset"
              }`}>
                {token.symbol.slice(0, 3)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{token.name}</p>
                <p className="text-[10px] text-gray-500 font-mono">{token.symbol}</p>
              </div>
            </div>

            {/* Activity count */}
            <div className="flex items-center justify-end">
              <span className="text-sm font-bold text-white tabular-nums">{token.totalActivity}</span>
            </div>

            {/* Transfers */}
            <div className="hidden sm:flex items-center justify-end">
              <span className="text-xs text-blue-400 tabular-nums">{token.totalTransfers}</span>
            </div>

            {/* Mints */}
            <div className="hidden sm:flex items-center justify-end">
              <span className="text-xs text-green-400 tabular-nums">{token.totalMints}</span>
            </div>

            {/* Burns */}
            <div className="hidden sm:flex items-center justify-end">
              <span className="text-xs text-red-400 tabular-nums">{token.totalBurns}</span>
            </div>

            {/* Last activity */}
            <div className="hidden sm:flex items-center justify-end">
              <span className="text-[10px] text-gray-600 tabular-nums">{formatTimeAgo(token.lastActivity)}</span>
            </div>

            {/* Mobile stats row */}
            <div className="flex items-center gap-3 sm:hidden mt-1.5">
              <span className="text-[9px] text-gray-600">#{index + 1}</span>
              <span className="text-[10px] text-blue-400 tabular-nums">{token.totalTransfers} T</span>
              <span className="text-[10px] text-green-400 tabular-nums">{token.totalMints} M</span>
              <span className="text-[10px] text-red-400 tabular-nums">{token.totalBurns} B</span>
              <span className="text-[10px] text-gray-600 ml-auto">{formatTimeAgo(token.lastActivity)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
