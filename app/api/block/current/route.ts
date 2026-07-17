import { NextResponse } from "next/server";
import { getProvider } from "@/lib/b20-server";
import { cacheGet, cacheSet, cacheKey, TTL } from "@/lib/rpc-cache";

export const dynamic = "force-dynamic";
export const preferredRegion = ["iad1"];

export async function GET() {
  const cache = cacheKey("block", "current");
  const cached = cacheGet<number>(cache);
  if (cached) return NextResponse.json({ blockNumber: cached });

  try {
    const provider = getProvider();
    const blockNumber = await provider.getBlockNumber();
    cacheSet(cache, blockNumber, TTL.BLOCK_NUMBER);
    return NextResponse.json({ blockNumber });
  } catch (err) {
    console.error("Block number fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch block number" }, { status: 500 });
  }
}
