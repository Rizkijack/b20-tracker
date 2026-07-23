"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ChartFrameModalProps {
  /** DexScreener pair address (lowercase 0x…). If null, a fallback message is shown. */
  pairAddress: string | null;
  /** Token symbol, shown in the modal title bar. */
  tokenSymbol?: string;
  /** Called when the user requests to close the modal. */
  onClose: () => void;
}

/**
 * Full-screen overlay that embeds the native DexScreener chart widget for a
 * Base pair. Renders the complete DexScreener trading UI (candles, MA lines,
 * crosshair, swaps feed, pool stats) at full viewport size.
 *
 * The embed URL follows DexScreener's widget format:
 *   https://dexscreener.com/base/{pairAddress}?embed=1&theme=dark&info=1&swaps=1&trader=1
 */
export default function ChartFrameModal({
  pairAddress,
  tokenSymbol,
  onClose,
}: ChartFrameModalProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ESC to close + lock body scroll while open
  const handleClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [handleClose]);

  const embedUrl =
    pairAddress && /^0x[a-fA-F0-9]{40}$/.test(pairAddress)
      ? `https://dexscreener.com/base/${pairAddress.toLowerCase()}?embed=1&theme=dark&info=1&swaps=1&trader=1`
      : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${tokenSymbol ?? "Token"} price chart`}
      onClick={handleClose}
    >
      {/* Title / close bar */}
      <div
        className="flex items-center justify-between px-4 py-3 sm:px-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-white truncate">
            {tokenSymbol ? `${tokenSymbol} Chart` : "Price Chart"}
          </span>
          <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-medium text-gray-300 shrink-0">
            via DexScreener
          </span>
          {pairAddress && (
            <span className="hidden sm:inline text-[10px] font-mono text-gray-500 truncate">
              {pairAddress}
            </span>
          )}
        </div>
        <button
          onClick={handleClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/50"
          aria-label="Close chart"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Chart body */}
      <div
        className="flex-1 px-3 pb-3 sm:px-6 sm:pb-6 min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {!embedUrl ? (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-500/10 mx-auto mb-4">
              <svg className="h-7 w-7 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
              </svg>
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              No DexScreener pair available for this token
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              The chart frame requires an active DEX pool discovered via DexScreener
            </p>
          </div>
        ) : (
          <div className="relative h-full w-full overflow-hidden rounded-xl border border-white/10 bg-[#0D0D0D]">
            {!loaded && !errored && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0D0D0D]">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0052FF] border-t-transparent" role="status" aria-label="Loading chart" />
                <p className="mt-3 text-xs text-gray-500">Loading DexScreener…</p>
              </div>
            )}
            {errored && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0D0D0D]">
                <p className="text-sm text-gray-400">Failed to load chart</p>
                {embedUrl && (
                  <a
                    href={embedUrl.replace(/[?&].*$/, "")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10 transition-all"
                  >
                    Open on DexScreener
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={embedUrl}
              title={`${tokenSymbol ?? "Token"} DexScreener chart`}
              className="h-full w-full"
              style={{ border: "0", minHeight: "60vh" }}
              loading="lazy"
              allow="clipboard-read; clipboard-write"
              onLoad={() => setLoaded(true)}
              onError={() => setErrored(true)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
