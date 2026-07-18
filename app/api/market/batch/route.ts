// app/api/market/batch/route.ts
// GET /api/market/batch?addresses=0x...,0x...,0x...
// Returns Map<string, TokenMarketData> for multiple B20 token addresses.
//
// Query params:
//   addresses (required) — comma-separated Base contract addresses (max 20)
//   sources   (optional) — comma-separated source list (same as /api/market)

import { NextResponse } from "next/server";
import { batchFetchMarketData, type FetchMarketDataOptions } from "@/lib/market-data";
import type { MarketDataSource } from "@/lib/types";

export const runtime = "nodejs";
export const revalidate = 0;

const MAX_BATCH = 20;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const addressesRaw = searchParams.get("addresses");

  if (!addressesRaw) {
    return NextResponse.json(
      { error: "Missing 'addresses' query param" },
      { status: 400 },
    );
  }

  const addresses = addressesRaw
    .split(",")
    .map((a) => a.trim())
    .filter((a) => /^0x[a-fA-F0-9]{40}$/.test(a));

  if (addresses.length === 0) {
    return NextResponse.json(
      { error: "No valid addresses provided" },
      { status: 400 },
    );
  }

  if (addresses.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `At most ${MAX_BATCH} addresses per batch` },
      { status: 400 },
    );
  }

  const sourcesRaw = searchParams.get("sources");
  const opts: FetchMarketDataOptions = {};

  if (sourcesRaw) {
    const allowed: MarketDataSource[] = [
      "dexscreener",
      "geckoterminal",
      "birdeye",
      "coingecko",
      "coinmarketcap",
    ];
    const requested = sourcesRaw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s): s is MarketDataSource =>
        allowed.includes(s as MarketDataSource),
      );
    if (requested.length > 0) opts.sources = requested;
  }

  try {
    const map = await batchFetchMarketData(addresses, opts);
    // Convert Map to plain object for JSON serialization
    const payload: Record<string, unknown> = {};
    for (const [addr, data] of map.entries()) {
      payload[addr] = data;
    }
    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
