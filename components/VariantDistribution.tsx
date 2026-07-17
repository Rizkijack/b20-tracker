"use client";

import type { VariantDistribution } from "@/lib/analytics";

interface VariantDistributionProps {
  data: VariantDistribution[];
  totalTokens: number;
}

export default function VariantDistribution({ data, totalTokens }: VariantDistributionProps) {
  // Calculate SVG donut chart
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
    <div className="glass-card p-5">
      <div>
        <h3 className="text-sm font-semibold text-white">Token Variants</h3>
        <p className="text-[10px] text-gray-500 mt-0.5">
          Asset vs Stablecoin distribution
        </p>
      </div>

      <div className="flex flex-col items-center mt-4">
        {/* SVG Donut */}
        <div className="relative">
          <svg width={size} height={size} className="-rotate-90">
            {/* Background circle */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={strokeWidth}
            />
            {/* Segments */}
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
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-white tabular-nums">
              {totalTokens}
            </span>
            <span className="text-[10px] text-gray-500">Total</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-6 mt-4">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: item.color }}
              ></span>
              <div>
                <p className="text-xs text-gray-400">{item.name}</p>
                <p className="text-sm font-bold text-white tabular-nums">
                  {item.value}
                  <span className="text-[10px] text-gray-500 font-normal ml-1">
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
