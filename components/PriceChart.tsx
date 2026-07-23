"use client";

import { useEffect, useMemo, useState } from "react";

interface OhlcvCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface PriceChartProps {
  address: string;
  /**
   * When true, the "Price Chart" title is hidden (the % change badge and
   * timeframe controls remain). Used when PriceChart is embedded inside a
   * wrapper that already provides a title — e.g. ChartSection.
   */
  hideHeader?: boolean;
}

type Timeframe = "day" | "hour" | "minute";

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  day: "1D",
  hour: "1H",
  minute: "5m",
};

/**
 * Lightweight SVG-based price chart for B20 tokens.
 * No external chart library — pure SVG rendering of close-price line + volume bars.
 *
 * Data source: /api/ohlcv (GeckoTerminal pools)
 */
export default function PriceChart({ address, hideHeader }: PriceChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("day");
  const [candles, setCandles] = useState<OhlcvCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const limit = timeframe === "day" ? 30 : timeframe === "hour" ? 48 : 96;
        const res = await fetch(
          `/api/ohlcv?address=${address}&timeframe=${timeframe}&limit=${limit}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) {
          setCandles(data.candles || []);
          if ((data.candles || []).length === 0) {
            setError("No trading activity yet");
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load chart");
          setCandles([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [address, timeframe]);

  // Compute SVG paths
  const chart = useMemo(() => {
    if (candles.length === 0) return null;

    const W = 800;
    const H = 240;
    const PAD_L = 8;
    const PAD_R = 8;
    const PAD_T = 12;
    const PAD_B = 40; // space for volume bars

    const priceH = H - PAD_T - PAD_B;
    const volH = 28;

    const closes = candles.map((c) => c.c);
    const vols = candles.map((c) => c.v);

    const minP = Math.min(...closes);
    const maxP = Math.max(...closes);
    const rangeP = maxP - minP || 1;
    const maxV = Math.max(...vols) || 1;

    const stepX = (W - PAD_L - PAD_R) / Math.max(candles.length - 1, 1);

    // Build close-price line path
    let linePath = "";
    let areaPath = "";
    closes.forEach((p, i) => {
      const x = PAD_L + i * stepX;
      const y = PAD_T + priceH - ((p - minP) / rangeP) * priceH;
      if (i === 0) {
        linePath = `M ${x.toFixed(2)} ${y.toFixed(2)}`;
        areaPath = `M ${x.toFixed(2)} ${(PAD_T + priceH).toFixed(2)} L ${x.toFixed(2)} ${y.toFixed(2)}`;
      } else {
        linePath += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
        areaPath += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
      }
    });
    // Close area path back to baseline
    const lastX = PAD_L + (closes.length - 1) * stepX;
    areaPath += ` L ${lastX.toFixed(2)} ${(PAD_T + priceH).toFixed(2)} Z`;

    // Volume bars
    const barWidth = Math.max(stepX * 0.7, 1);
    const bars = candles.map((c, i) => {
      const x = PAD_L + i * stepX - barWidth / 2;
      const h = (c.v / maxV) * volH;
      const y = H - h;
      const isUp = c.c >= c.o;
      return { x, y, h, w: barWidth, isUp };
    });

    // Y-axis ticks (5 levels)
    const ticks: Array<{ y: number; label: string }> = [];
    for (let i = 0; i <= 4; i++) {
      const price = minP + (rangeP * i) / 4;
      const y = PAD_T + priceH - (priceH * i) / 4;
      ticks.push({
        y,
        label:
          price >= 1
            ? `$${price.toFixed(2)}`
            : `$${price.toFixed(6)}`,
      });
    }

    // Compute overall price change for header badge
    const first = closes[0];
    const last = closes[closes.length - 1];
    const changePct = ((last - first) / first) * 100;
    const isUp = changePct >= 0;

    return {
      W,
      H,
      linePath,
      areaPath,
      bars,
      ticks,
      changePct,
      isUp,
      minP,
      maxP,
    };
  }, [candles]);

  return (
    <div className={hideHeader ? "" : "rounded-xl border border-white/10 bg-white/[0.03] p-5"}>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {!hideHeader && (
            <h2 className="text-sm font-semibold text-white">Price Chart</h2>
          )}
          {chart && (
            <span
              className={`text-xs font-semibold tabular-nums ${
                chart.isUp ? "text-green-400" : "text-red-400"
              }`}
            >
              {chart.isUp ? "+" : ""}
              {chart.changePct.toFixed(2)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
          {(Object.keys(TIMEFRAME_LABELS) as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                timeframe === tf
                  ? "bg-[#0052FF] text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {TIMEFRAME_LABELS[tf]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-[240px] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0052FF] border-t-transparent" />
        </div>
      ) : error ? (
        <div className="flex h-[240px] flex-col items-center justify-center">
          <p className="text-sm text-gray-500">{error}</p>
          <p className="text-xs text-gray-600 mt-1">
            Chart requires active DEX pools on Base
          </p>
        </div>
      ) : chart ? (
        <svg
          viewBox={`0 0 ${chart.W} ${chart.H}`}
          className="w-full"
          preserveAspectRatio="none"
          style={{ height: "240px" }}
        >
          <defs>
            <linearGradient id="priceArea" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={chart.isUp ? "#0052FF" : "#ff4757"}
                stopOpacity="0.3"
              />
              <stop
                offset="100%"
                stopColor={chart.isUp ? "#0052FF" : "#ff4757"}
                stopOpacity="0"
              />
            </linearGradient>
          </defs>

          {/* Y-axis gridlines + labels */}
          {chart.ticks.map((tick, i) => (
            <g key={i}>
              <line
                x1="0"
                y1={tick.y}
                x2={chart.W}
                y2={tick.y}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
              <text
                x={chart.W - 4}
                y={tick.y - 3}
                fontSize="9"
                fill="rgba(255,255,255,0.4)"
                textAnchor="end"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* Area fill */}
          <path d={chart.areaPath} fill="url(#priceArea)" />

          {/* Price line */}
          <path
            d={chart.linePath}
            fill="none"
            stroke={chart.isUp ? "#0052FF" : "#ff4757"}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Volume bars */}
          {chart.bars.map((b, i) => (
            <rect
              key={i}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              fill={b.isUp ? "rgba(0,208,132,0.4)" : "rgba(255,71,87,0.4)"}
            />
          ))}
        </svg>
      ) : null}

      <div className="mt-2 flex items-center justify-between text-[10px] text-gray-600">
        <span>
          {candles.length} candles · via GeckoTerminal
        </span>
        <span>
          {candles.length > 0 &&
            new Date(candles[0].t * 1000).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}{" "}
          →{" "}
          {candles.length > 0 &&
            new Date(candles[candles.length - 1].t * 1000).toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric" },
            )}
        </span>
      </div>
    </div>
  );
}
