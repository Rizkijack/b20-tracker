// app/api/market/route.ts
// GET /api/market?address=0x...
// Returns aggregated TokenMarketData for a single B20 token address.
//
// Query params:
//   address  (required) — token contract address
//   sources  (optional) — comma-separated list of sources to query:
//                         dexscreener,geckoterminal,birdeye,coingecko,coinmarketcap

import { NextResponse } from "next/server";
import { fetchTokenMarketData, type FetchMarketDataOptions } from "@/lib/market-data";
import type { MarketDataSource } from "@/lib/types";

export const runtime = "nodejs"; // ensure server-side execution
export const revalidate = 0;     // no static generation; dynamic response

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: "Invalid or missing 'address' query param" },
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
    const data = await fetchTokenMarketData(address, opts);
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
