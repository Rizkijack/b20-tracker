"use client";

import Link from "next/link";
import type { B20Token } from "@/lib/types";
import { formatAmount, truncateAddress } from "@/lib/b20-client";
import { EXPLORER_URL } from "@/lib/constants";

interface TokenListProps {
  tokens: B20Token[];
  searchQuery: string;
}

export default function TokenList({ tokens, searchQuery }: TokenListProps) {
  const filtered = tokens.filter((token) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      token.name.toLowerCase().includes(q) ||
      token.symbol.toLowerCase().includes(q) ||
      token.address.toLowerCase().includes(q)
    );
  });

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <h2 className="text-sm font-semibold text-white">
          B20 Tokens
          <span className="ml-2 rounded-full bg-[#0052FF]/20 px-2 py-0.5 text-xs text-[#0052FF]">
            {filtered.length}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            Sorted by most recent
          </span>
        </div>
      </div>

      {/* Token List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-gray-400 text-sm">
            {searchQuery
              ? "No tokens match your search"
              : "Scanning Base Mainnet for B20 tokens..."}
          </p>
          {!searchQuery && (
            <p className="text-gray-600 text-xs mt-1">
              This may take a moment on first load
            </p>
          )}
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {filtered.map((token) => (
            <Link
              key={token.address}
              href={`/token/${token.address}`}
              className="flex items-center gap-4 px-5 py-3 transition-all hover:bg-white/[0.04] group"
            >
              {/* Token Icon */}
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold ${
                  token.variant === "stablecoin"
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                }`}
              >
                {token.symbol.slice(0, 3)}
              </div>

              {/* Token Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white truncate text-sm">
                    {token.name}
                  </span>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
                    {token.symbol}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      token.variant === "stablecoin"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-purple-500/20 text-purple-400"
                    }`}
                  >
                    {token.variant === "stablecoin" ? "💵 Stablecoin" : "📊 Asset"}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <a
                    href={`${EXPLORER_URL}/address/${token.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500 font-mono hover:text-gray-300 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {truncateAddress(token.address, 8)}
                  </a>
                </div>
              </div>

              {/* Supply */}
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-white tabular-nums">
                  {formatAmount(token.totalSupply, token.decimals)}
                </p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                  Total Supply
                </p>
              </div>

              {/* Arrow */}
              <svg
                className="h-4 w-4 text-gray-600 transition-all group-hover:text-[#0052FF] group-hover:translate-x-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
