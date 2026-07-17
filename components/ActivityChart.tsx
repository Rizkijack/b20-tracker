"use client";

import type { HourlyActivity } from "@/lib/analytics";

interface ActivityChartProps {
  data: HourlyActivity[];
}

export default function ActivityChart({ data }: ActivityChartProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const hasActivity = data.some((d) => d.count > 0);

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Hourly Activity</h3>
          <p className="text-[10px] text-gray-500 mt-0.5">
            Transfers, mints & burns in the last 24 hours
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-blue-500"></span>
            <span className="text-[10px] text-gray-500">Transfer</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-green-500"></span>
            <span className="text-[10px] text-gray-500">Mint</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-red-500"></span>
            <span className="text-[10px] text-gray-500">Burn</span>
          </div>
        </div>
      </div>

      {!hasActivity ? (
        <div className="flex items-center justify-center h-32">
          <p className="text-xs text-gray-500">No activity data in the last 24 hours</p>
        </div>
      ) : (
        <div className="flex items-end gap-1 h-32">
          {data.map((item) => {
            const height = maxCount > 0 ? Math.max((item.count / maxCount) * 100, 4) : 4;

            return (
              <div
                key={item.hour}
                className="flex-1 flex flex-col items-center justify-end h-full group relative"
              >
                {/* Stacked bars */}
                <div className="w-full flex flex-col-reverse items-center" style={{ height: `${height}%` }}>
                  {item.burns > 0 && (
                    <div
                      className="w-full rounded-t-sm bg-red-500/70 transition-all group-hover:bg-red-400"
                      style={{ height: `${(item.burns / item.count) * 100}%`, minHeight: 2 }}
                    ></div>
                  )}
                  {item.mints > 0 && (
                    <div
                      className="w-full bg-green-500/70 transition-all group-hover:bg-green-400"
                      style={{ height: `${(item.mints / item.count) * 100}%`, minHeight: 2 }}
                    ></div>
                  )}
                  {item.transfers > 0 && (
                    <div
                      className="w-full rounded-t-sm bg-blue-500/70 transition-all group-hover:bg-blue-400"
                      style={{ height: `${(item.transfers / item.count) * 100}%`, minHeight: 2 }}
                    ></div>
                  )}
                </div>

                {/* Tooltip on hover */}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full hidden group-hover:block z-10">
                  <div className="bg-[#1A2335] border border-white/[0.1] rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap">
                    <p className="text-[10px] font-semibold text-white">{item.label}</p>
                    <div className="text-[9px] text-gray-400 mt-0.5">
                      <span className="text-blue-400">{item.transfers}</span> T ·{" "}
                      <span className="text-green-400">{item.mints}</span> M ·{" "}
                      <span className="text-red-400">{item.burns}</span> B
                    </div>
                  </div>
                </div>

                <span className="text-[8px] text-gray-600 mt-1.5">
                  {item.hour}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
