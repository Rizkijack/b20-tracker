"use client";

import type { B20Stats } from "@/lib/types";

interface StatsBarProps {
  stats: B20Stats;
  blockHeight: number;
}

type GetValueFn = (stats: B20Stats, block: number) => string;

interface StatCardDef {
  label: string;
  subtitle: string;
  getValue: GetValueFn;
  icon: React.ReactNode;
  iconBg: string;
}

const statCards: StatCardDef[] = [
  {
    label: "Total Tokens",
    subtitle: "All B20 tokens",
    getValue: (s) => s.totalTokens.toString(),
    icon: (
      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    iconBg: "var(--accent-blue-dim)",
  },
  {
    label: "Assets",
    subtitle: "Token assets",
    getValue: (s) => s.totalAssetTokens.toString(),
    icon: (
      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    iconBg: "var(--accent-purple-dim)",
  },
  {
    label: "Stablecoins",
    subtitle: "Stablecoin tokens",
    getValue: (s) => s.totalStablecoinTokens.toString(),
    icon: (
      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    iconBg: "var(--accent-green-dim)",
  },
  {
    label: "Block Height",
    subtitle: "Current block",
    getValue: (_s, block) => block.toLocaleString(),
    icon: (
      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    iconBg: "var(--accent-cyan)",
  },
];

export default function StatsBar({ stats, blockHeight }: StatsBarProps) {
  return (
    <section aria-label="Dashboard statistics" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {statCards.map((card) => (
        <div
          key={card.label}
          className="glass-card group p-3.5"
          role="group"
          aria-label={`${card.label}: ${card.getValue(stats, blockHeight)}`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-md"
              style={{ background: card.iconBg, color: "inherit" }}
            >
              {card.icon}
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-tertiary)" }}>
              {card.label}
            </span>
          </div>
          <p className="text-xl font-bold tabular-nums tracking-tight" style={{ color: "var(--text-primary)" }}>
            {card.getValue(stats, blockHeight)}
          </p>
        </div>
      ))}
    </section>
  );
}
