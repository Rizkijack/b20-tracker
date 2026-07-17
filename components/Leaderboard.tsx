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
      <div className="glass-card p-5" role="region" aria-label="Most active tokens leaderboard">
        <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Most Active Tokens</h3>
        <p className="text-[10px] mb-4" style={{ color: "var(--text-tertiary)" }}>
          Top tokens by on-chain activity in 24h
        </p>
        <div className="flex flex-col items-center justify-center py-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.03] mb-2">
            <svg className="h-5 w-5" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>No activity in the last 24 hours</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden" role="region" aria-label="Most active tokens leaderboard">
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Most Active Tokens</h3>
        <p className="text-[10px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
          Top tokens by on-chain activity in 24h
        </p>
      </div>

      {/* Table header */}
      <div className="hidden sm:grid sm:grid-cols-[24px_1fr_80px_80px_80px_80px_80px] gap-2 px-5 py-2 border-t border-[var(--border-subtle)]" aria-hidden="true">
        <span className="table-header">#</span>
        <span className="table-header">Token</span>
        <span className="table-header text-right">Activity</span>
        <span className="table-header text-right">Transfers</span>
        <span className="table-header text-right">Mints</span>
        <span className="table-header text-right">Burns</span>
        <span className="table-header text-right">Last</span>
      </div>

      <div className="divide-y divide-[var(--border-subtle)]" role="list" aria-label="Leaderboard entries">
        {data.map((token, index) => (
          <Link
            key={token.address}
            href={`/token/${token.address}`}
            className="table-row block sm:grid sm:grid-cols-[24px_1fr_80px_80px_80px_80px_80px] sm:gap-2 px-5 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3B82F6]/50"
            role="listitem"
            aria-label={`#${index + 1}: ${token.name} - ${token.totalActivity} total activities`}
          >
            {/* Rank */}
            <div className="hidden sm:flex items-center">
              <span className={`text-xs font-bold tabular-nums ${
                index === 0 ? "text-yellow-500" :
                index === 1 ? "text-gray-300" :
                index === 2 ? "text-amber-600" :
                ""
              }`} style={index > 2 ? { color: "var(--text-muted)" } : {}}>
                #{index + 1}
              </span>
            </div>

            {/* Token info */}
            <div className="flex items-center gap-2.5 mb-1 sm:mb-0">
              <div className={`token-icon h-8 w-8 text-[10px] ${token.variant === "stablecoin" ? "token-icon-stablecoin" : "token-icon-asset"}`} aria-hidden="true">
                {token.symbol.slice(0, 3)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{token.name}</p>
                <p className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>{token.symbol}</p>
              </div>
            </div>

            {/* Activity count */}
            <div className="flex items-center justify-end">
              <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{token.totalActivity}</span>
            </div>

            {/* Transfers */}
            <div className="hidden sm:flex items-center justify-end">
              <span className="text-xs tabular-nums" style={{ color: "var(--accent-blue)" }}>{token.totalTransfers}</span>
            </div>

            {/* Mints */}
            <div className="hidden sm:flex items-center justify-end">
              <span className="text-xs tabular-nums" style={{ color: "var(--accent-green)" }}>{token.totalMints}</span>
            </div>

            {/* Burns */}
            <div className="hidden sm:flex items-center justify-end">
              <span className="text-xs tabular-nums" style={{ color: "var(--accent-red)" }}>{token.totalBurns}</span>
            </div>

            {/* Last activity */}
            <div className="hidden sm:flex items-center justify-end">
              <span className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>{formatTimeAgo(token.lastActivity)}</span>
            </div>

            {/* Mobile stats row */}
            <div className="flex items-center gap-3 sm:hidden mt-1.5" aria-hidden="true">
              <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>#{index + 1}</span>
              <span className="text-[10px] tabular-nums" style={{ color: "var(--accent-blue)" }}>{token.totalTransfers} T</span>
              <span className="text-[10px] tabular-nums" style={{ color: "var(--accent-green)" }}>{token.totalMints} M</span>
              <span className="text-[10px] tabular-nums" style={{ color: "var(--accent-red)" }}>{token.totalBurns} B</span>
              <span className="text-[10px] ml-auto" style={{ color: "var(--text-muted)" }}>{formatTimeAgo(token.lastActivity)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
