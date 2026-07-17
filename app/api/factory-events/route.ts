import { NextRequest, NextResponse } from "next/server";
import { id } from "ethers";
import { getProvider } from "@/lib/b20-server";
import { B20_FACTORY_ADDRESS } from "@/lib/constants";
import { cacheGet, cacheSet, cacheKey, TTL } from "@/lib/rpc-cache";

export const dynamic = "force-dynamic";

// Compute the B20Created event signature hash at runtime
// Based on B20 factory spec: event B20Created(uint8 variant, address creator, address token, bytes32 salt)
const B20_CREATED_TOPIC = id("B20Created(uint8,address,address,bytes32)");

export async function GET(request: NextRequest) {
  const fromBlock = parseInt(request.nextUrl.searchParams.get("fromBlock") || "");
  const toBlock = parseInt(request.nextUrl.searchParams.get("toBlock") || "");

  if (isNaN(fromBlock) || isNaN(toBlock) || fromBlock < 0 || toBlock < fromBlock) {
    return NextResponse.json({ error: "Invalid block range" }, { status: 400 });
  }

  const cache = cacheKey("factory-events", fromBlock, toBlock);
  const cached = cacheGet<{ topics: string[]; data: string; blockNumber: number; txHash: string; logIndex: number }[]>(cache);
  if (cached) return NextResponse.json(cached);

  try {
    const provider = getProvider();

    const logs = await provider.getLogs({
      address: B20_FACTORY_ADDRESS,
      fromBlock,
      toBlock,
      topics: [B20_CREATED_TOPIC],
    });

    const result = logs.map((log) => ({
      topics: [...log.topics],
      data: log.data,
      blockNumber: Number(log.blockNumber),
      txHash: log.transactionHash ?? "",
      logIndex: Number(log.index),
    }));

    cacheSet(cache, result, TTL.TOKEN_DISCOVERY);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Factory events fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch factory events" },
      { status: 500 },
    );
  }
}
