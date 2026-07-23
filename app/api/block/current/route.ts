import { NextResponse } from "next/server";
import { getCurrentBlockNumber } from "@/lib/b20-discovery";
import { cacheGetSync, cacheKey } from "@/lib/rpc-cache";

export const dynamic = "force-dynamic";
export const preferredRegion = ["iad1"];

export async function GET() {
  // getCurrentBlockNumber() owns the shared 2s in-memory cache + provider
  // rotation/retry. This route is a thin HTTP wrapper around it.
  try {
    const blockNumber = await getCurrentBlockNumber();
    return NextResponse.json({ blockNumber });
  } catch (err) {
    console.error("Block number fetch error:", err);
    // Graceful degrade: return last cached value (even if stale) under rate limits.
    const stale = cacheGetSync<number>(cacheKey("block", "current"));
    if (stale !== undefined) {
      return NextResponse.json({ blockNumber: stale, stale: true });
    }
    return NextResponse.json(
      { error: "Failed to fetch block number" },
      { status: 500 },
    );
  }
}
