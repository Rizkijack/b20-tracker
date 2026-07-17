import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/b20-server";
import { cacheGet, cacheSet, cacheKey, TTL } from "@/lib/rpc-cache";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const blockNumber = parseInt(request.nextUrl.searchParams.get("blockNumber") || "");
  if (isNaN(blockNumber) || blockNumber < 0) {
    return NextResponse.json({ error: "Invalid blockNumber" }, { status: 400 });
  }

  const cache = cacheKey("block", "ts", blockNumber);
  const cached = cacheGet<number>(cache);
  if (cached) return NextResponse.json({ timestamp: cached });

  try {
    const provider = getProvider();
    const block = await provider.getBlock(blockNumber);
    const timestamp = block ? block.timestamp : Math.floor(Date.now() / 1000);
    cacheSet(cache, timestamp, TTL.BLOCK_TIMESTAMP);
    return NextResponse.json({ timestamp });
  } catch (err) {
    console.error("Block timestamp fetch error:", err);
    return NextResponse.json(
      { timestamp: Math.floor(Date.now() / 1000) },
    );
  }
}
