import { NextRequest, NextResponse } from "next/server";
import { id } from "ethers";
import { getProvider } from "@/lib/b20-server";
import { cacheGet, cacheSet, cacheKey, TTL } from "@/lib/rpc-cache";

export const dynamic = "force-dynamic";
export const preferredRegion = ["iad1"];

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  const fromBlock = parseInt(request.nextUrl.searchParams.get("fromBlock") || "");
  const toBlock = parseInt(request.nextUrl.searchParams.get("toBlock") || "");

  if (!address || isNaN(fromBlock) || isNaN(toBlock)) {
    return NextResponse.json({ error: "Missing or invalid params" }, { status: 400 });
  }

  const cache = cacheKey("token-events", address.toLowerCase(), fromBlock, toBlock);
  const cached = cacheGet<{ topics: string[]; data: string; blockNumber: number; txHash: string; logIndex: number }[]>(cache);
  if (cached) return NextResponse.json(cached);

  try {
    const provider = getProvider();
    const transferTopic = id("Transfer(address,address,uint256)");

    const logs = await provider.getLogs({
      fromBlock,
      toBlock,
      address,
      topics: [transferTopic],
    });

    const result = logs.map((log) => ({
      topics: [...log.topics],
      data: log.data,
      blockNumber: Number(log.blockNumber),
      txHash: log.transactionHash ?? "",
      logIndex: Number(log.index),
    }));

    cacheSet(cache, result, TTL.TOKEN_EVENTS);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json([]);
  }
}
