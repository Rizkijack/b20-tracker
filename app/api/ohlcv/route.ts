// app/api/ohlcv/route.ts
// GET /api/ohlcv?address=0x...&timeframe=day&limit=30
// Returns OHLCV candles for a Base token via GeckoTerminal (free, no key).
//
// Strategy:
//   1. Fetch token's top pool on Base (highest liquidity)
//   2. Fetch OHLCV for that pool from GeckoTerminal
//   3. Normalize to a simple candle array for client rendering
//
// Query params:
//   address   (required) — token contract address
//   timeframe (optional) — day | hour | minute (default: day)
//   limit     (optional) — number of candles, max 100 (default: 30)

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 0;

const GT_BASE = "https://api.geckoterminal.com/api/v2";
const NETWORK = "base";
const MAX_LIMIT = 100;

// Aggregate values allowed by GeckoTerminal per timeframe
const AGGREGATE: Record<string, number> = {
  day: 1,
  hour: 1,
  minute: 5, // 5-minute candles for intraday granularity
};

interface GtPoolResponse {
  data?: Array<{
    id?: string;
    attributes?: {
      address?: string;
      reserve_in_usd?: string;
    };
  }>;
}

interface GtOhlcvResponse {
  data?: {
    attributes?: {
      ohlcv_list?: Array<[number, number, number, number, number, number]>;
      // [timestamp, open, high, low, close, volume]
    };
  };
}

export interface OhlcvCandle {
  t: number; // unix timestamp (seconds)
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

async function fetchJson(url: string, retries = 1): Promise<unknown> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 }, // cache at edge for 60s
      });
      if (!res.ok) {
        if (res.status === 429 && i < retries) {
          await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
          continue;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (i < retries) await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastErr;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const timeframe = searchParams.get("timeframe") ?? "day";
  const limitRaw = parseInt(searchParams.get("limit") ?? "30", 10);
  const limit = Math.min(Math.max(limitRaw, 1), MAX_LIMIT);

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: "Invalid or missing 'address' query param" },
      { status: 400 },
    );
  }

  if (!(timeframe in AGGREGATE)) {
    return NextResponse.json(
      { error: `Invalid timeframe. Use: ${Object.keys(AGGREGATE).join(", ")}` },
      { status: 400 },
    );
  }

  try {
    // Step 1: find the token's top pool on Base
    const poolsRes = (await fetchJson(
      `${GT_BASE}/networks/${NETWORK}/tokens/${address.toLowerCase()}/pools?page=1`,
    )) as GtPoolResponse;

    const pools = poolsRes.data ?? [];
    if (pools.length === 0) {
      return NextResponse.json(
        { error: "No pools found for this token on Base", candles: [] },
        { status: 404 },
      );
    }

    // Sort by liquidity descending, pick the top pool
    const sorted = [...pools].sort((a, b) => {
      const la = parseFloat(a.attributes?.reserve_in_usd ?? "0");
      const lb = parseFloat(b.attributes?.reserve_in_usd ?? "0");
      return lb - la;
    });
    const poolAddress = sorted[0].attributes?.address;
    if (!poolAddress) {
      return NextResponse.json(
        { error: "Could not resolve pool address", candles: [] },
        { status: 500 },
      );
    }

    // Step 2: fetch OHLCV for that pool
    const aggregate = AGGREGATE[timeframe];
    const ohlcvRes = (await fetchJson(
      `${GT_BASE}/networks/${NETWORK}/pools/${poolAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}&currency=usd`,
    )) as GtOhlcvResponse;

    const list = ohlcvRes.data?.attributes?.ohlcv_list ?? [];
    const candles: OhlcvCandle[] = list
      .map(([t, o, h, l, c, v]) => ({ t, o, h, l, c, v }))
      // GeckoTerminal returns newest first — reverse for chronological order
      .reverse();

    return NextResponse.json(
      {
        address: address.toLowerCase(),
        pool: poolAddress,
        timeframe,
        candles,
        source: "geckoterminal",
      },
      { status: 200 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: msg, candles: [] },
      { status: 500 },
    );
  }
}
