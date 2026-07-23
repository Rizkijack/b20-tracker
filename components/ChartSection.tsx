"use client";

import { useCallback, useEffect, useState } from "react";
import PriceChart from "@/components/PriceChart";
import ChartFrameModal from "@/components/ChartFrameModal";
import type { TokenMarketData } from "@/lib/types";

interface ChartSectionProps {
  /** Token contract address — passed to the inline PriceChart. */
  address: string;
  /** Token symbol, shown in the modal title. */
  symbol?: string;
  /**
   * DexScreener pair address, when known up front (e.g. from useTokenDetail's
   * marketData). If omitted, ChartSection lazily resolves it via /api/market
   * the first time the user clicks Expand — this keeps the RSC-style
   * TokenDetailContent (which doesn't fetch market data) working.
   */
  pairAddress?: string | null;
}

/**
 * Composes the compact inline PriceChart with an "Expand" affordordance that
 * opens a full-screen DexScreener chart frame (ChartFrameModal).
 *
 * Replaces the bare `<PriceChart address={address} />` usages across both
 * token detail entry points so the expand-to-fullscreen behavior is shared.
 */
export default function ChartSection({
  address,
  symbol,
  pairAddress,
}: ChartSectionProps) {
  const [open, setOpen] = useState(false);
  const [resolvedPair, setResolvedPair] = useState<string | null>(
    pairAddress ?? null,
  );
  const [resolving, setResolving] = useState(false);

  // Keep in sync if the parent re-resolves market data (e.g. live polling)
  useEffect(() => {
    if (pairAddress) setResolvedPair(pairAddress);
  }, [pairAddress]);

  // Lazily resolve a DexScreener pair address on first expand click when the
  // caller didn't provide one. Caches the result for subsequent opens.
  const ensurePairResolved = useCallback(async () => {
    if (resolvedPair || resolving) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/market?address=${address}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as TokenMarketData;
      if (data?.dexScreenerPairAddress) {
        setResolvedPair(data.dexScreenerPairAddress);
      }
    } catch {
      // leave resolvedPair null — modal shows the "no pair" fallback
    } finally {
      setResolving(false);
    }
  }, [address, resolvedPair, resolving]);

  const handleExpand = useCallback(() => {
    if (!resolvedPair) {
      void ensurePairResolved();
    }
    setOpen(true);
  }, [resolvedPair, ensurePairResolved]);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
        <h2 className="text-sm font-semibold text-white">Price Chart</h2>
        <button
          onClick={handleExpand}
          disabled={resolving}
          title={
            resolvedPair
              ? "Open full-screen chart"
              : "Resolve DexScreener pair, then open full-screen chart"
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition-all hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/50"
          aria-label="Expand chart to full screen"
        >
          {resolving ? (
            <>
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
              Resolving
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Expand
            </>
          )}
        </button>
      </div>

      <div className="p-5 pt-4">
        <PriceChart address={address} hideHeader />
      </div>

      {open && (
        <ChartFrameModal
          pairAddress={resolvedPair}
          tokenSymbol={symbol}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
