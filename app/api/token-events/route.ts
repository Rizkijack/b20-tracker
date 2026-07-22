import { NextRequest, NextResponse } from "next/server";
import { rpcCall } from "@/lib/b20-client";
import { cacheGet, cacheSet, TTL } from "@/lib/server-cache";
import { ALL_B20_EVENT_TOPICS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  const fromBlock = parseInt(request.nextUrl.searchParams.get("fromBlock") || "");
  const toBlock = parseInt(request.nextUrl.searchParams.get("toBlock") || "");

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address) || isNaN(fromBlock) || isNaN(toBlock)) {
    return NextResponse.json({ error: "Missing or invalid params" }, { status: 400 });
  }

  const cacheK = `token-events:${address.toLowerCase()}:${fromBlock}:${toBlock}`;
  const cached = await cacheGet<{ topics: string[]; data: string; blockNumber: number; txHash: string; logIndex: number }[]>(cacheK);
  if (cached) return NextResponse.json(cached);

  try {
    const logs = await rpcCall((p) =>
      p.getLogs({
        fromBlock,
        toBlock,
        address,
        topics: [ALL_B20_EVENT_TOPICS],
      }),
    );

    const result = logs.map((log) => ({
      topics: [...log.topics],
      data: log.data,
      blockNumber: Number(log.blockNumber),
      txHash: log.transactionHash ?? "",
      logIndex: Number(log.index),
    }));

    await cacheSet(cacheK, result, TTL.BLOCK);
    return NextResponse.json(result);
  } catch (err) {
    console.error("token-events error:", err);
    return NextResponse.json([]);
  }
}
