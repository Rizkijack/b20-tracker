"use client";

import type { DailyMintBurn } from "@/lib/analytics";

interface MintBurnChartProps {
  data: DailyMintBurn[];
}

export default function MintBurnChart({ data }: MintBurnChartProps) {
  const maxVal = Math.max(...data.map((d) => Math.max(d.mints, d.burns, d.transfers)), 1);
  const hasActivity = data.some((d) => d.mints > 0 || d.burns > 0 || d.transfers > 0);

  return (
    <div className="glass-card p-5" role="region" aria-label="Daily activity chart">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Daily Activity</h3>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
            Last 7 days of on-chain activity
          </p>
        </div>
      </div>

      {!hasActivity ? (
        <div className="flex items-center justify-center h-40">
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>No activity data in the last 7 days</p>
        </div>
      ) : (
        <div className="flex items-end gap-3 h-40" role="img" aria-label={`Daily activity bar chart showing ${data.reduce((s, d) => s + d.transfers + d.mints + d.burns, 0)} total events over 7 days`}>
          {data.map((day) => {
            const totalHeight = maxVal > 0 ? (Math.max(day.mints, day.burns, day.transfers) / maxVal) * 100 : 4;
            const mintHeight = maxVal > 0 ? (day.mints / maxVal) * 100 : 0;
            const burnHeight = maxVal > 0 ? (day.burns / maxVal) * 100 : 0;
            const transferHeight = maxVal > 0 ? (day.transfers / maxVal) * 100 : 0;

            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center justify-end h-full group relative"
                aria-label={`${day.label}: ${day.transfers} transfers, ${day.mints} mints, ${day.burns} burns`}
              >
                <div className="w-full flex items-end justify-center gap-0.5" style={{ height: `${Math.max(totalHeight, 4)}%` }}>
                  <div
                    className="flex-1 rounded-t-sm transition-all group-hover:opacity-80"
                    style={{ height: `${Math.max(transferHeight, day.transfers > 0 ? 2 : 0)}%`, backgroundColor: "var(--accent-blue)" }}
                  ></div>
                  <div
                    className="flex-1 rounded-t-sm transition-all group-hover:opacity-80"
                    style={{ height: `${Math.max(mintHeight, day.mints > 0 ? 2 : 0)}%`, backgroundColor: "var(--accent-green)" }}
                  ></div>
                  <div
                    className="flex-1 rounded-t-sm transition-all group-hover:opacity-80"
                    style={{ height: `${Math.max(burnHeight, day.burns > 0 ? 2 : 0)}%`, backgroundColor: "var(--accent-red)" }}
                  ></div>
                </div>

                {/* Tooltip */}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full hidden group-hover:block z-10" role="tooltip">
                  <div className="chart-tooltip bg-[var(--bg-card-hover)] border border-[var(--border-default)] rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap">
                    <p className="text-[10px] font-semibold" style={{ color: "var(--text-primary)" }}>{day.label}</p>
                    <div className="text-[9px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                      <span style={{ color: "var(--accent-blue)" }}>{day.transfers}</span> T ·
                      <span style={{ color: "var(--accent-green)" }}> {day.mints}</span> M ·
                      <span style={{ color: "var(--accent-red)" }}> {day.burns}</span> B
                    </div>
                  </div>
                </div>

                <span className="text-[8px] mt-1.5" style={{ color: "var(--text-muted)" }} aria-hidden="true">
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[var(--border-subtle)]" aria-hidden="true">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "var(--accent-blue)" }}></span>
          <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Transfers</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "var(--accent-green)" }}></span>
          <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Mints</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "var(--accent-red)" }}></span>
          <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Burns</span>
        </div>
      </div>
    </div>
  );
}
