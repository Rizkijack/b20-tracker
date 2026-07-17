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

  const cache = cacheKey("discover", fromBlock, toBlock);
  const cached = cacheGet<{ address: string; blockNumber: number; txHash: string }[]>(cache);
  if (cached) return NextResponse.json(cached);

  try {
    const provider = getProvider();
    const transferTopic = id("Transfer(address,address,uint256)");
    const tokens: { address: string; blockNumber: number; txHash: string }[] = [];
    const seen = new Set<string>();

    for (let start = fromBlock; start <= toBlock; start += CHUNK_SIZE) {
      const end = Math.min(start + CHUNK_SIZE - 1, toBlock);
      try {
        const logs = await provider.getLogs({
          fromBlock: start,
          toBlock: end,
          topics: [transferTopic],
        });

        for (const log of logs) {
          const addr = log.address.toLowerCase();
          if (isB20Address(addr) && !seen.has(addr)) {
            seen.add(addr);
            tokens.push({
              address: log.address,
              blockNumber: Number(log.blockNumber),
              txHash: log.transactionHash ?? "",
            });
          }
        }
      } catch {
        // skip chunk on error
      }
    }

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
