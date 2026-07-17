"use client";

import type { DailyMintBurn } from "@/lib/analytics";

interface MintBurnChartProps {
  data: DailyMintBurn[];
}

export default function MintBurnChart({ data }: MintBurnChartProps) {
  const maxVal = Math.max(...data.map((d) => Math.max(d.mints, d.burns, d.transfers)), 1);
  const hasActivity = data.some((d) => d.mints > 0 || d.burns > 0 || d.transfers > 0);

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Daily Activity</h3>
          <p className="text-[10px] text-gray-500 mt-0.5">
            Last 7 days of on-chain activity
          </p>
        </div>
      </div>

      {!hasActivity ? (
        <div className="flex items-center justify-center h-40">
          <p className="text-xs text-gray-500">No activity data in the last 7 days</p>
        </div>
      ) : (
        <div className="flex items-end gap-3 h-40">
          {data.map((day) => {
            const totalHeight = maxVal > 0 ? (Math.max(day.mints, day.burns, day.transfers) / maxVal) * 100 : 4;
            const mintHeight = maxVal > 0 ? (day.mints / maxVal) * 100 : 0;
            const burnHeight = maxVal > 0 ? (day.burns / maxVal) * 100 : 0;
            const transferHeight = maxVal > 0 ? (day.transfers / maxVal) * 100 : 0;

            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center justify-end h-full group relative"
              >
                <div className="w-full flex items-end justify-center gap-0.5" style={{ height: `${Math.max(totalHeight, 4)}%` }}>
                  <div
                    className="flex-1 rounded-t-sm bg-blue-500/70 transition-all group-hover:bg-blue-400"
                    style={{ height: `${Math.max(transferHeight, day.transfers > 0 ? 2 : 0)}%` }}
                  ></div>
                  <div
                    className="flex-1 rounded-t-sm bg-green-500/70 transition-all group-hover:bg-green-400"
                    style={{ height: `${Math.max(mintHeight, day.mints > 0 ? 2 : 0)}%` }}
                  ></div>
                  <div
                    className="flex-1 rounded-t-sm bg-red-500/70 transition-all group-hover:bg-red-400"
                    style={{ height: `${Math.max(burnHeight, day.burns > 0 ? 2 : 0)}%` }}
                  ></div>
                </div>

                <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full hidden group-hover:block z-10">
                  <div className="bg-[#1A2335] border border-white/[0.1] rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap">
                    <p className="text-[10px] font-semibold text-white">{day.label}</p>
                    <div className="text-[9px] text-gray-400 mt-0.5">
                      <span className="text-blue-400">{day.transfers}</span> T ·{" "}
                      <span className="text-green-400">{day.mints}</span> M ·{" "}
                      <span className="text-red-400">{day.burns}</span> B
                    </div>
                  </div>
                </div>

                <span className="text-[8px] text-gray-600 mt-1.5">
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-500/70"></span>
          <span className="text-[10px] text-gray-500">Transfers</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-green-500/70"></span>
          <span className="text-[10px] text-gray-500">Mints</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-500/70"></span>
          <span className="text-[10px] text-gray-500">Burns</span>
        </div>
      </div>
    </div>
  );
}
