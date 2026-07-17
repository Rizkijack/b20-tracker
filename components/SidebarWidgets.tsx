"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { B20Event, B20Token, CreatedTokenInfo } from "@/lib/types";
import { truncateAddress } from "@/lib/b20-client";
import { computeAnalytics } from "@/lib/analytics";
import { getEventBadgeColor, getEventLabel, decodeB20CreatedEvent } from "@/lib/event-decoder";
import { fetchFactoryCreatedEvents, getCurrentBlockNumber, fetchTokenMetadata } from "@/lib/api-client";

interface SidebarWidgetsProps {
  events: B20Event[];
  tokens: B20Token[];
}

function formatTimeAgo(timestamp: number): string {
  if (!timestamp) return "";
  const diff = Math.floor(Date.now() / 1000) - timestamp;
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function SidebarWidgets({ events, tokens }: SidebarWidgetsProps) {
  // ── Recently Created Tokens ────────────────────────────────────
  const [recentlyCreated, setRecentlyCreated] = useState<CreatedTokenInfo[]>([]);
  const createdResolvedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fetchCreated = async () => {
      try {
        const latestBlock = await getCurrentBlockNumber();
        const fromBlock = Math.max(0, latestBlock - 43200); // ~24 hours of blocks (2s each)
        const logs = await fetchFactoryCreatedEvents(fromBlock, latestBlock);

        const decoded: CreatedTokenInfo[] = [];
        for (const log of logs) {
          const event = decodeB20CreatedEvent(log);
          if (!event) continue;
          decoded.push({
            address: event.tokenAddress,
            creator: event.creator,
            variant: event.variant,
            salt: event.salt,
            blockNumber: event.blockNumber,
            txHash: event.txHash,
            logIndex: event.logIndex,
            timestamp: 0,
          });
        }

        // Sort newest first
        decoded.sort((a, b) => b.blockNumber - a.blockNumber);

        // Resolve token names for the first few (with caching)
        const enriched: CreatedTokenInfo[] = [];
        for (const item of decoded.slice(0, 5)) {
          if (createdResolvedRef.current.has(item.address)) {
            enriched.push(item);
            continue;
          }
          createdResolvedRef.current.add(item.address);
          try {
            const meta = await fetchTokenMetadata(item.address);
            enriched.push({ ...item, name: meta.name, symbol: meta.symbol });
          } catch {
            enriched.push(item);
          }
        }

        setRecentlyCreated(enriched);
      } catch {
        // silently fail
      }
    };

    fetchCreated();
  }, []);

  const analytics = useMemo(() => computeAnalytics(events, tokens), [events, tokens]);
  const { hourlyActivity } = analytics;
  const maxCount = Math.max(...hourlyActivity.map((h) => h.count), 1);
  const hasActivity = hourlyActivity.some((h) => h.count > 0);

  // Recent mint/burn events
  const mintBurnEvents = useMemo(
    () => events.filter((e) => e.type === "mint" || e.type === "burn").slice(0, 6),
    [events]
  );

  // Paused tokens
  const pausedTokens = tokens.filter((t) => t.isPaused);

  // Total supply across all tokens in a compact format
  const totalSupplyValue = tokens.reduce((acc, t) => acc + t.totalSupply, BigInt(0));
  const supplyStr = totalSupplyValue > BigInt(0)
    ? totalSupplyValue.toString().slice(0, 6) + (totalSupplyValue.toString().length > 6 ? "..." : "")
    : "0";

  return (
    <div className="space-y-4">
      {/* ── Mini Activity Sparkline ────────────────────────────── */}
      <div className="glass-card p-4" role="region" aria-label="24h activity sparkline">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>24h Activity</h3>
          <span className="text-[10px] font-mono tabular-nums" style={{ color: "var(--text-tertiary)" }}>
            {analytics.totalEvents24h} events
          </span>
        </div>
        {!hasActivity ? (
          <div className="flex items-center justify-center h-10">
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>No data</p>
          </div>
        ) : (
          <div className="flex items-end gap-[2px] h-10" aria-label="24h activity mini chart">
            {hourlyActivity.map((item) => {
              const height = maxCount > 0 ? Math.max((item.count / maxCount) * 100, 5) : 5;
              return (
                <div
                  key={item.hour}
                  className="flex-1 rounded-sm transition-all hover:opacity-80"
                  style={{
                    height: `${height}%`,
                    backgroundColor: item.count > 0
                      ? item.mints > 0
                        ? "var(--accent-green)"
                        : item.burns > 0
                          ? "var(--accent-red)"
                          : "var(--accent-blue)"
                      : "var(--border-subtle)",
                  }}
                  aria-label={`${item.label}: ${item.count} events`}
                  title={`${item.label}: ${item.transfers}T ${item.mints}M ${item.burns}B`}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Quick Stats Mini ──────────────────────────────────── */}
      <div className="glass-card p-4" role="region" aria-label="Quick statistics">
        <h3 className="text-xs font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Quick Stats</h3>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-[var(--accent-blue-dim)]">
                <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" style={{ color: "var(--accent-blue)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Total Supply</span>
            </div>
            <span className="text-[10px] font-mono font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
              {supplyStr}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-[var(--accent-green-dim)]">
                <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" style={{ color: "var(--accent-green)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>24h Mints</span>
            </div>
            <span className="text-[10px] font-mono font-semibold tabular-nums" style={{ color: "var(--accent-green)" }}>
              {analytics.totalMints24h}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-[var(--accent-red-dim)]">
                <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" style={{ color: "var(--accent-red)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </div>
              <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>24h Burns</span>
            </div>
            <span className="text-[10px] font-mono font-semibold tabular-nums" style={{ color: "var(--accent-red)" }}>
              {analytics.totalBurns24h}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-[var(--accent-purple-dim)]">
                <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" style={{ color: "var(--accent-purple)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Active Tokens</span>
            </div>
            <span className="text-[10px] font-mono font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
              {analytics.uniqueTokens24h}
            </span>
          </div>
        </div>
      </div>

      {/* ── Recent Mints & Burns ───────────────────────────────── */}
      <div className="glass-card p-4" role="region" aria-label="Recent mints and burns">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Recent Mints & Burns</h3>
          {mintBurnEvents.length > 0 && (
            <span className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
              {events.filter(e => e.type === "mint").length}M / {events.filter(e => e.type === "burn").length}B
            </span>
          )}
        </div>

        {mintBurnEvents.length === 0 ? (
          <div className="flex items-center justify-center py-6">
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>No mints or burns yet</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {mintBurnEvents.map((event) => (
              <Link
                key={event.id}
                href={`/token/${event.tokenAddress}`}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors hover:bg-[var(--accent-blue-dim)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/50"
                aria-label={`${getEventLabel(event.type)} event`}
              >
                <span className={`inline-flex items-center rounded px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider ${getEventBadgeColor(event.type)}`}>
                  {getEventLabel(event.type)}
                </span>
                <span className="flex-1 text-[10px] font-mono truncate" style={{ color: "var(--text-secondary)" }}>
                  {truncateAddress(event.tokenAddress, 4)}
                </span>
                <span className="text-[9px] font-mono tabular-nums shrink-0" style={{ color: "var(--text-muted)" }}>
                  {formatTimeAgo(event.timestamp)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Recently Created Tokens ────────────────────────────── */}
      <div className="glass-card p-4" role="region" aria-label="Recently created tokens">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Recently Created</h3>
          <span className="text-[10px] font-mono tabular-nums" style={{ color: "var(--text-tertiary)" }}>
            {recentlyCreated.length > 0 ? `${recentlyCreated.length} new` : "24h"}
          </span>
        </div>

        {recentlyCreated.length === 0 ? (
          <div className="flex items-center gap-2 py-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-blue-dim)]">
              <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" style={{ color: "var(--accent-blue)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>No new tokens in 24h</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {recentlyCreated.map((item, idx) => (
              <Link
                key={`${item.txHash}-${item.logIndex}`}
                href={`/token/${item.address}`}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors hover:bg-[var(--accent-blue-dim)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/50"
                aria-label={`Token created: ${item.symbol || truncateAddress(item.address, 4)}`}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded bg-[var(--accent-blue-dim)] shrink-0" aria-hidden="true">
                  <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--accent-blue)" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {item.symbol || truncateAddress(item.address, 4)}
                  </p>
                  <p className="text-[8px] font-mono truncate" style={{ color: "var(--text-muted)" }}>
                    {item.name || truncateAddress(item.address, 6)}
                  </p>
                </div>
                <span className="text-[9px] font-mono tabular-nums shrink-0" style={{ color: "var(--text-muted)" }}>
                  #{idx + 1}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Paused Tokens ──────────────────────────────────────── */}
      <div className="glass-card p-4" role="region" aria-label="Paused tokens">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Paused Tokens</h3>
          <span className="text-[10px] font-mono tabular-nums" style={{ color: pausedTokens.length > 0 ? "var(--accent-red)" : "var(--accent-green)" }}>
            {pausedTokens.length}
          </span>
        </div>

        {pausedTokens.length === 0 ? (
          <div className="flex items-center gap-2 py-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-green-dim)]">
              <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" style={{ color: "var(--accent-green)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>All tokens active</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {pausedTokens.slice(0, 5).map((token) => (
              <Link
                key={token.address}
                href={`/token/${token.address}`}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors hover:bg-[var(--accent-red-dim)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/50"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded bg-[var(--accent-red-dim)]" aria-hidden="true">
                  <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--accent-red)" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="flex-1 text-[10px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {token.symbol}
                </span>
                <span className="text-[9px] font-mono truncate" style={{ color: "var(--text-muted)" }}>
                  {truncateAddress(token.address, 3)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
