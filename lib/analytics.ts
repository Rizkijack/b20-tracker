// Analytics computation utilities for the B20 Tracker dashboard

import type { B20Event, B20Token } from "./types";

// ─── Types ────────────────────────────────────────────────────────

export interface HourlyActivity {
  hour: string; // "00", "01", ... "23"
  label: string; // "00:00", "01:00", ...
  count: number;
  mints: number;
  burns: number;
  transfers: number;
}

export interface DailyMintBurn {
  date: string; // "2025-07-15"
  label: string; // "Jul 15"
  mints: number;
  burns: number;
  transfers: number;
}

export interface VariantDistribution {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

export interface TokenActivity {
  address: string;
  name: string;
  symbol: string;
  variant: "asset" | "stablecoin";
  totalTransfers: number;
  totalMints: number;
  totalBurns: number;
  totalActivity: number;
  lastActivity: number; // timestamp
}

export interface AnalyticsData {
  hourlyActivity: HourlyActivity[];
  dailyMintBurn: DailyMintBurn[];
  variantDistribution: VariantDistribution[];
  mostActiveTokens: TokenActivity[];
  totalEvents24h: number;
  totalMints24h: number;
  totalBurns24h: number;
  uniqueTokens24h: number;
}

// ─── Helpers ──────────────────────────────────────────────────────

function getHourLabel(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Compute analytics from events and tokens ─────────────────────

export function computeAnalytics(
  events: B20Event[],
  tokens: B20Token[],
): AnalyticsData {
  const now = Math.floor(Date.now() / 1000);
  const twentyFourHoursAgo = now - 86400;

  // Filter recent events
  const recentEvents = events.filter((e) => e.timestamp >= twentyFourHoursAgo);

  // ── Hourly Activity ──────────────────────────────────────────
  const hourlyMap = new Map<number, { count: number; mints: number; burns: number; transfers: number }>();

  for (let h = 0; h < 24; h++) {
    hourlyMap.set(h, { count: 0, mints: 0, burns: 0, transfers: 0 });
  }

  for (const event of recentEvents) {
    const hour = new Date(event.timestamp * 1000).getUTCHours();
    const slot = hourlyMap.get(hour);
    if (slot) {
      slot.count++;
      if (event.type === "mint") slot.mints++;
      else if (event.type === "burn") slot.burns++;
      else if (event.type === "transfer") slot.transfers++;
    }
  }

  const hourlyActivity: HourlyActivity[] = [];
  for (let h = 0; h < 24; h++) {
    const slot = hourlyMap.get(h)!;
    hourlyActivity.push({
      hour: h.toString().padStart(2, "0"),
      label: getHourLabel(h),
      count: slot.count,
      mints: slot.mints,
      burns: slot.burns,
      transfers: slot.transfers,
    });
  }

  // ── Daily Mint/Burn (last 7 days) ────────────────────────────
  const sevenDaysAgo = now - 604800;
  const weeklyEvents = events.filter((e) => e.timestamp >= sevenDaysAgo);

  const dailyMap = new Map<string, { mints: number; burns: number; transfers: number }>();

  for (const event of weeklyEvents) {
    const date = new Date(event.timestamp * 1000);
    const dateStr = date.toISOString().slice(0, 10);
    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, { mints: 0, burns: 0, transfers: 0 });
    }
    const slot = dailyMap.get(dateStr)!;
    if (event.type === "mint") slot.mints++;
    else if (event.type === "burn") slot.burns++;
    else if (event.type === "transfer") slot.transfers++;
  }

  const dailyMintBurn: DailyMintBurn[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date((now - i * 86400) * 1000);
    const dateStr = d.toISOString().slice(0, 10);
    const slot = dailyMap.get(dateStr) || { mints: 0, burns: 0, transfers: 0 };
    dailyMintBurn.push({
      date: dateStr,
      label: getDateLabel(dateStr),
      mints: slot.mints,
      burns: slot.burns,
      transfers: slot.transfers,
    });
  }

  // ── Variant Distribution ──────────────────────────────────────
  const assets = tokens.filter((t) => t.variant === "asset").length;
  const stablecoins = tokens.filter((t) => t.variant === "stablecoin").length;
  const total = tokens.length || 1;

  const variantDistribution: VariantDistribution[] = [
    {
      name: "Assets",
      value: assets,
      percentage: Math.round((assets / total) * 100),
      color: "#A855F7",
    },
    {
      name: "Stablecoins",
      value: stablecoins,
      percentage: Math.round((stablecoins / total) * 100),
      color: "#22C55E",
    },
  ];

  // ── Most Active Tokens ────────────────────────────────────────
  const tokenActivityMap = new Map<
    string,
    { totalTransfers: number; totalMints: number; totalBurns: number; lastActivity: number }
  >();

  for (const event of recentEvents) {
    const addr = event.tokenAddress.toLowerCase();
    if (!tokenActivityMap.has(addr)) {
      tokenActivityMap.set(addr, {
        totalTransfers: 0,
        totalMints: 0,
        totalBurns: 0,
        lastActivity: 0,
      });
    }
    const slot = tokenActivityMap.get(addr)!;
    if (event.type === "mint") slot.totalMints++;
    else if (event.type === "burn") slot.totalBurns++;
    else if (event.type === "transfer") slot.totalTransfers++;
    if (event.timestamp > slot.lastActivity) slot.lastActivity = event.timestamp;
  }

  const tokenMap = new Map(tokens.map((t) => [t.address.toLowerCase(), t]));

  const mostActiveTokens: TokenActivity[] = [];
  for (const [addr, activity] of tokenActivityMap) {
    const token = tokenMap.get(addr);
    const totalActivity = activity.totalTransfers + activity.totalMints + activity.totalBurns;
    mostActiveTokens.push({
      address: addr,
      name: token?.name || "Unknown",
      symbol: token?.symbol || "???",
      variant: token?.variant || "asset",
      totalTransfers: activity.totalTransfers,
      totalMints: activity.totalMints,
      totalBurns: activity.totalBurns,
      totalActivity,
      lastActivity: activity.lastActivity,
    });
  }

  // Sort by total activity descending, take top 10
  mostActiveTokens.sort((a, b) => b.totalActivity - a.totalActivity);

  // Aggregate totals
  const totalEvents24h = recentEvents.length;
  const totalMints24h = recentEvents.filter((e) => e.type === "mint").length;
  const totalBurns24h = recentEvents.filter((e) => e.type === "burn").length;
  const uniqueTokens24h = new Set(recentEvents.map((e) => e.tokenAddress.toLowerCase())).size;

  return {
    hourlyActivity,
    dailyMintBurn,
    variantDistribution,
    mostActiveTokens: mostActiveTokens.slice(0, 10),
    totalEvents24h,
    totalMints24h,
    totalBurns24h,
    uniqueTokens24h,
  };
}
