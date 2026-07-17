"use client";

import type { HourlyActivity } from "@/lib/analytics";

interface ActivityChartProps {
  data: HourlyActivity[];
}

export default function ActivityChart({ data }: ActivityChartProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const hasActivity = data.some((d) => d.count > 0);

  return (
    <div className="glass-card p-5" role="region" aria-label="Hourly activity chart">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Hourly Activity</h3>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
            Transfers, mints & burns in the last 24 hours
          </p>
        </div>
        <div className="flex items-center gap-3" aria-hidden="true">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[var(--accent-blue)]"></span>
            <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Transfer</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[var(--accent-green)]"></span>
            <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Mint</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[var(--accent-red)]"></span>
            <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Burn</span>
          </div>
        </div>
      </div>

      {!hasActivity ? (
        <div className="flex items-center justify-center h-32">
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>No activity data in the last 24 hours</p>
        </div>
      ) : (
        <div className="flex items-end gap-1 h-32" role="img" aria-label={`Hourly activity bar chart showing ${data.reduce((s, d) => s + d.count, 0)} total events across 24 hours`}>
          {data.map((item) => {
            const height = maxCount > 0 ? Math.max((item.count / maxCount) * 100, 4) : 4;

            return (
              <div
                key={item.hour}
                className="flex-1 flex flex-col items-center justify-end h-full group relative"
                aria-label={`${item.label}: ${item.transfers} transfers, ${item.mints} mints, ${item.burns} burns`}
              >
                <div className="w-full flex flex-col-reverse items-center" style={{ height: `${height}%` }}>
                  {item.burns > 0 && (
                    <div
                      className="w-full rounded-t-sm transition-all group-hover:opacity-80"
                      style={{ height: `${(item.burns / item.count) * 100}%`, minHeight: 2, backgroundColor: "var(--accent-red)" }}
                    ></div>
                  )}
                  {item.mints > 0 && (
                    <div
                      className="w-full transition-all group-hover:opacity-80"
                      style={{ height: `${(item.mints / item.count) * 100}%`, minHeight: 2, backgroundColor: "var(--accent-green)" }}
                    ></div>
                  )}
                  {item.transfers > 0 && (
                    <div
                      className="w-full rounded-t-sm transition-all group-hover:opacity-80"
                      style={{ height: `${(item.transfers / item.count) * 100}%`, minHeight: 2, backgroundColor: "var(--accent-blue)" }}
                    ></div>
                  )}
                </div>

                {/* Tooltip */}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full hidden group-hover:block z-10" role="tooltip">
                  <div className="chart-tooltip bg-[var(--bg-card-hover)] border border-[var(--border-default)] rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap">
                    <p className="text-[10px] font-semibold" style={{ color: "var(--text-primary)" }}>{item.label}</p>
                    <div className="text-[9px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                      <span style={{ color: "var(--accent-blue)" }}>{item.transfers}</span> T ·
                      <span style={{ color: "var(--accent-green)" }}> {item.mints}</span> M ·
                      <span style={{ color: "var(--accent-red)" }}> {item.burns}</span> B
                    </div>
                  </div>
                </div>

                <span className="text-[8px] mt-1.5" style={{ color: "var(--text-muted)" }} aria-hidden="true">
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
