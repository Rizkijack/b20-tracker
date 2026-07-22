// app/api/discover/route.ts
// GET /api/discover?fromBlock=X&toBlock=Y
// Returns B20 tokens created in the given block range by scanning
// B20Created events emitted by the B20_FACTORY precompile.
//
// This is the canonical discovery path: the factory emits exactly one
// B20Created event per token, so we filter logs by the factory address
// (not by scanning every Transfer log on Base).

import { NextRequest, NextResponse } from "next/server";
import { discoverB20Tokens } from "@/lib/b20-client";
import { cacheGet, cacheSet, cacheKey, TTL } from "@/lib/rpc-cache";

export const dynamic = "force-dynamic";
export const preferredRegion = ["iad1"];

interface DiscoveredToken {
  address: string;
  blockNumber: number;
  txHash: string;
  variant: number;
  name: string;
  symbol: string;
  decimals: number;
}

export async function GET(request: NextRequest) {
  const fromBlock = parseInt(request.nextUrl.searchParams.get("fromBlock") || "");
  const toBlock = parseInt(request.nextUrl.searchParams.get("toBlock") || "");

  if (isNaN(fromBlock) || isNaN(toBlock) || fromBlock < 0 || toBlock < fromBlock) {
    return NextResponse.json({ error: "Invalid block range" }, { status: 400 });
  }

  const cache = cacheKey("discover", fromBlock, toBlock);
  const cached = cacheGet<DiscoveredToken[]>(cache);
  if (cached) return NextResponse.json(cached);

  try {
    // discoverB20Tokens now scans the factory's B20Created events directly.
    const tokens = await discoverB20Tokens(fromBlock, toBlock);

    cacheSet(cache, tokens, TTL.TOKEN_DISCOVERY);
    return NextResponse.json(tokens);
  } catch (err) {
    console.error("Discovery error:", err);
    return NextResponse.json(
      { error: "Failed to discover tokens" },
      { status: 500 },
    );
  }
}
