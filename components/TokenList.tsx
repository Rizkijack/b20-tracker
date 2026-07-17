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

  if (filtered.length === 0) {
    return (
      <div className="glass-card overflow-hidden" role="region" aria-label="Token list">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>B20 Tokens</h2>
            <span className="badge-blue">{filtered.length}</span>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.03] mb-3">
            <svg className="h-6 w-6" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {searchQuery ? "No tokens match your search" : "No B20 tokens found"}
          </p>
          {!searchQuery && (
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Scanning Base Mainnet for B20-prefixed addresses
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden" role="region" aria-label="Token list">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>B20 Tokens</h2>
          <span className="badge-blue" aria-label={`${filtered.length} tokens`}>{filtered.length}</span>
        </div>
        <span className="text-[10px] uppercase tracking-[0.06em]" style={{ color: "var(--text-tertiary)" }}>
          {tokens.length} found
        </span>
      </div>

      {/* Table Header - desktop */}
      <div className="hidden sm:grid sm:grid-cols-[1fr_100px_140px_120px_20px] gap-3 px-4 py-2 border-b border-[var(--border-subtle)]" role="row" aria-hidden="true">
        <span className="table-header">Token</span>
        <span className="table-header text-right">Type</span>
        <span className="table-header text-right">Total Supply</span>
        <span className="table-header text-right">Address</span>
        <span></span>
      </div>

      {/* Token Rows */}
      <div className="divide-y divide-[var(--border-subtle)]" role="list" aria-label="Token list items">
        {filtered.map((token, index) => (
          <Link
            key={token.address}
            href={`/token/${token.address}`}
            className="table-row block sm:grid sm:grid-cols-[1fr_100px_140px_120px_20px] sm:gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3B82F6]/50"
            role="listitem"
            aria-label={`${token.name} (${token.symbol}) - ${token.variant === "stablecoin" ? "Stablecoin" : "Asset"} - Supply: ${formatAmount(token.totalSupply, token.decimals)}`}
          >
            {/* Token info */}
            <div className="flex items-center gap-3">
              <div
                className={`token-icon ${token.variant === "stablecoin" ? "token-icon-stablecoin" : "token-icon-asset"}`}
                aria-hidden="true"
              >
                {token.symbol.slice(0, 3)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate" style={{ color: "var(--text-primary)" }}>
                    {token.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                    {token.symbol}
                  </span>
                  {token.variant === "stablecoin" && token.currency && (
                    <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                      · {token.currency}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Variant badge */}
            <div className="hidden sm:flex items-center justify-end">
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                token.variant === "stablecoin" ? "badge-green" : "badge-purple"
              }`}>
                {token.variant === "stablecoin" ? "Stable" : "Asset"}
              </span>
            </div>

            {/* Supply */}
            <div className="hidden sm:flex items-center justify-end">
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {formatAmount(token.totalSupply, token.decimals)}
                </p>
                <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
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
                className="font-mono text-[11px] link-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/50"
                onClick={(e) => e.stopPropagation()}
                aria-label={`View ${token.symbol} on Basescan`}
              >
                {truncateAddress(token.address, 4)}
              </a>
            </div>

            {/* Arrow */}
            <div className="hidden sm:flex items-center justify-end">
              <svg className="h-3.5 w-3.5 transition-all group-hover:translate-x-0.5" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>

            {/* Mobile info */}
            <div className="flex items-center gap-3 mt-1.5 sm:hidden" aria-hidden="true">
              <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                token.variant === "stablecoin" ? "badge-green" : "badge-purple"
              }`}>
                {token.variant === "stablecoin" ? "Stable" : "Asset"}
              </span>
              <span className="text-[11px] tabular-nums font-mono" style={{ color: "var(--text-secondary)" }}>
                {formatAmount(token.totalSupply, token.decimals)}
              </span>
              <a
                href={`${EXPLORER_URL}/address/${token.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] ml-auto link-accent"
                onClick={(e) => e.stopPropagation()}
                aria-label={`View ${token.symbol} on Basescan`}
              >
                {truncateAddress(token.address, 3)}
              </a>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
