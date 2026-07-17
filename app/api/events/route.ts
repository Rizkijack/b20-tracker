import { NextRequest, NextResponse } from "next/server";
import { id } from "ethers";
import { getProvider, isB20Address } from "@/lib/b20-server";
import { cacheGet, cacheSet, cacheKey, TTL } from "@/lib/rpc-cache";

export const dynamic = "force-dynamic";
export const preferredRegion = ["iad1"];
const CHUNK_SIZE = 2000;

export async function GET(request: NextRequest) {
  const fromBlock = parseInt(request.nextUrl.searchParams.get("fromBlock") || "");
  const toBlock = parseInt(request.nextUrl.searchParams.get("toBlock") || "");

  if (isNaN(fromBlock) || isNaN(toBlock) || fromBlock < 0 || toBlock < fromBlock) {
    return NextResponse.json({ error: "Invalid block range" }, { status: 400 });
  }

  const cache = cacheKey("events", fromBlock, toBlock);
  const cached = cacheGet<{ topics: string[]; data: string; blockNumber: number; txHash: string; logIndex: number; address: string }[]>(cache);
  if (cached) return NextResponse.json(cached);

  try {
    const provider = getProvider();
    const transferTopic = id("Transfer(address,address,uint256)");
    const allLogs: { topics: string[]; data: string; blockNumber: number; txHash: string; logIndex: number; address: string }[] = [];

    for (let start = fromBlock; start <= toBlock; start += CHUNK_SIZE) {
      const end = Math.min(start + CHUNK_SIZE - 1, toBlock);
      try {
        const logs = await provider.getLogs({
          fromBlock: start,
          toBlock: end,
          topics: [transferTopic],
        });

        for (const log of logs) {
          if (isB20Address(log.address)) {
            allLogs.push({
              topics: [...log.topics],
              data: log.data,
              blockNumber: Number(log.blockNumber),
              txHash: log.transactionHash ?? "",
              logIndex: Number(log.index),
              address: log.address,
            });
          }
        }
      } catch {
        // skip chunk on error
      }
    }

    cacheSet(cache, allLogs, TTL.TOKEN_EVENTS);
    return NextResponse.json(allLogs);
  } catch (err) {
    console.error("Events fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 },
    );
  }
}
