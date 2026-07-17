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
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">B20 Tokens</h2>
          <span className="inline-flex items-center justify-center rounded-full bg-[#3B82F6]/10 px-2 py-0.5 text-[11px] font-medium text-[#3B82F6]">
            {filtered.length}
          </span>
        </div>
        <span className="text-[10px] text-gray-500 uppercase tracking-[0.06em]">
          {tokens.length} found
        </span>
      </div>

      {/* Token List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.03] mb-3">
            <svg className="h-6 w-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-sm text-gray-400">
            {searchQuery
              ? "No tokens match your search"
              : "No B20 tokens found"}
          </p>
          {searchQuery ? null : (
            <p className="text-xs text-gray-600 mt-1">
              Scanning Base Mainnet for B20-prefixed addresses
            </p>
          )}
        </div>
      ) : (
        <div>
          {/* Table Header - hidden on mobile */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_100px_140px_120px_20px] gap-3 px-4 py-2 border-b border-white/[0.04]">
            <span className="table-header">Token</span>
            <span className="table-header text-right">Type</span>
            <span className="table-header text-right">Total Supply</span>
            <span className="table-header text-right">Address</span>
            <span></span>
          </div>

          {/* Token Rows */}
          <div className="divide-y divide-white/[0.04]">
            {filtered.map((token) => (
              <Link
                key={token.address}
                href={`/token/${token.address}`}
                className="table-row block sm:grid sm:grid-cols-[1fr_100px_140px_120px_20px] sm:gap-3 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {/* Token Icon */}
                  <div className={`token-icon ${token.variant === "stablecoin" ? "token-icon-stablecoin" : "token-icon-asset"}`}>
                    {token.symbol.slice(0, 3)}
                  </div>

                  {/* Name + Symbol */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-white truncate">
                        {token.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] font-mono text-gray-500">
                        {token.symbol}
                      </span>
                      {token.variant === "stablecoin" && token.currency && (
                        <span className="text-[10px] text-gray-600 font-mono">
                          · {token.currency}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Variant Badge */}
                <div className="hidden sm:flex items-center justify-end">
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    token.variant === "stablecoin"
                      ? "badge-green"
                      : "badge-purple"
                  }`}>
                    {token.variant === "stablecoin" ? "Stable" : "Asset"}
                  </span>
                </div>

                {/* Supply */}
                <div className="hidden sm:flex items-center justify-end">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white tabular-nums">
                      {formatAmount(token.totalSupply, token.decimals)}
                    </p>
                    <p className="text-[9px] text-gray-600 uppercase tracking-wider">
                      supply
                    </p>
                  </div>
                </div>

                {/* Address */}
                <div className="hidden sm:flex items-center justify-end">
                  <a
                    href={`${EXPLORER_URL}/address/${token.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[11px] text-gray-500 link-accent"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {truncateAddress(token.address, 4)}
                  </a>
                </div>

                {/* Arrow */}
                <div className="hidden sm:flex items-center justify-end">
                  <svg className="h-3.5 w-3.5 text-gray-600 transition-all group-hover:text-[#3B82F6] group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                {/* Mobile variant + supply row */}
                <div className="flex items-center gap-3 mt-1.5 sm:hidden">
                  <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                    token.variant === "stablecoin"
                      ? "badge-green"
                      : "badge-purple"
                  }`}>
                    {token.variant === "stablecoin" ? "Stable" : "Asset"}
                  </span>
                  <span className="text-[11px] text-gray-400 tabular-nums font-mono">
                    {formatAmount(token.totalSupply, token.decimals)}
                  </span>
                  <a
                    href={`${EXPLORER_URL}/address/${token.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[10px] text-gray-600 ml-auto link-accent"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {truncateAddress(token.address, 3)}
                  </a>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
