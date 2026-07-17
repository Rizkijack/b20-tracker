"use client";

import type { VariantDistribution } from "@/lib/analytics";

interface VariantDistributionProps {
  data: VariantDistribution[];
  totalTokens: number;
}

export default function VariantDistribution({ data, totalTokens }: VariantDistributionProps) {
  const size = 140;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let offset = 0;
  const segments = data.map((item) => {
    const segOffset = offset;
    const length = (item.percentage / 100) * circumference;
    offset += length;
    return { ...item, length, offset: segOffset };
  });

  return (
    <div className="glass-card p-5" role="region" aria-label="Token variant distribution">
      <div>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Token Variants</h3>
        <p className="text-[10px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
          Asset vs Stablecoin distribution
        </p>
      </div>

      <div className="flex flex-col items-center mt-4">
        {/* SVG Donut */}
        <div className="relative" role="img" aria-label={`Token distribution: ${data.map(d => `${d.name} ${d.percentage}%`).join(", ")}`}>
          <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="var(--border-subtle)"
              strokeWidth={strokeWidth}
            />
            {segments.map((seg) => (
              <circle
                key={seg.name}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${seg.length} ${circumference - seg.length}`}
                strokeDashoffset={-seg.offset}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            ))}
          </svg>

          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
            <span className="text-2xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
              {totalTokens}
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Total</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-6 mt-4">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              ></span>
              <div>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{item.name}</p>
                <p className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {item.value}
                  <span className="text-[10px] font-normal ml-1" style={{ color: "var(--text-tertiary)" }}>
                    ({item.percentage}%)
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
