// app/api/b20-discover/route.ts
// GET /api/b20-discover?limit=100&window=50000
// Returns recently-created B20 tokens on Base Mainnet enriched with real-time
// market data from DexScreener + GeckoTerminal.
//
// This is the canonical real-time B20 discovery endpoint. It:
//   1. Scans B20Created events from the B20 factory precompile (authoritative
//      on-chain discovery, chunked to respect the 10k-block eth_getLogs limit).
//   2. Enriches each token with live price/liquidity/volume from DexScreener
//      (batched, free, no key) and GeckoTerminal (per-token fallback).
//
// Tokens without DEX liquidity are still returned (hasLiquidity=false) — they
// are real B20 tokens, just not yet traded on a DEX.

import { NextResponse } from "next/server";
import { getRecentB20TokensWithMarket } from "@/lib/b20-discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "100");
  const window = parseInt(searchParams.get("window") || "50000");

  if (isNaN(limit) || limit <= 0 || limit > 500) {
    return NextResponse.json(
      { error: "Invalid limit. Must be between 1 and 500" },
      { status: 400 },
    );
  }
  if (isNaN(window) || window <= 0 || window > 100000) {
    return NextResponse.json(
      { error: "Invalid window. Must be between 1 and 100000 blocks" },
      { status: 400 },
    );
  }

  try {
    const { tokens, currentBlock, source } = await getRecentB20TokensWithMarket(
      window,
      limit,
    );

    return NextResponse.json(
      {
        success: true,
        count: tokens.length,
        currentBlock,
        source,
        tokens,
        timestamp: Date.now(),
      },
      { status: 200 },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("B20 discover error:", error);
    return NextResponse.json(
      { success: false, error: `Failed to discover B20 tokens: ${msg}` },
      { status: 500 },
    );
  }
}
