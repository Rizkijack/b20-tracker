"use client";

import type { B20Stats } from "@/lib/types";
import { formatAmount } from "@/lib/b20-client";

interface StatsBarProps {
  stats: B20Stats;
  blockHeight: number;
}

export default function StatsBar({ stats, blockHeight }: StatsBarProps) {
  const statItems = [
    {
      label: "Total B20 Tokens",
      value: stats.totalTokens.toString(),
      icon: "🪙",
      color: "from-[#0052FF] to-[#0052FF]/60",
    },
    {
      label: "Assets",
      value: stats.totalAssetTokens.toString(),
      icon: "📊",
      color: "from-purple-500 to-purple-500/60",
    },
    {
      label: "Stablecoins",
      value: stats.totalStablecoinTokens.toString(),
      icon: "💵",
      color: "from-green-500 to-green-500/60",
    },
    {
      label: "Block Height",
      value: blockHeight.toLocaleString(),
      icon: "📦",
      color: "from-cyan-500 to-cyan-500/60",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
      {statItems.map((item) => (
        <div
          key={item.label}
          className="group relative overflow-hidden rounded-xl glass-panel p-5 transition-all duration-300 hover:-translate-y-1"
        >
          {/* Gradient accent line */}
          <div
            className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${item.color}`}
          />

          <div className="flex items-center gap-3 mb-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${item.color} shadow-lg shadow-black/20`}>
              <span className="text-xl">{item.icon}</span>
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              {item.label}
            </span>
          </div>
          <p className="text-3xl font-bold text-white tabular-nums tracking-tight">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
