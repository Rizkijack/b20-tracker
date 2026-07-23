// app/api/events/route.ts
// GET /api/events?fromBlock=X&toBlock=Y
// Returns recent B20 Transfer (and related) logs for the block range.
//
// Uses the rotation-aware RPC path and a short sync cache so concurrent SSE
// pollers coalesce instead of each hammering eth_getLogs.

import { NextRequest, NextResponse } from "next/server";
import { id } from "ethers";
import { isB20Address, getProvider } from "@/lib/b20-client";
import {
  cacheGetSync,
  cacheSetSync,
  cacheKey,
  TTL,
} from "@/lib/rpc-cache";
import { BASE_RPC_URLS } from "@/lib/constants";
import { JsonRpcProvider } from "ethers";

export const dynamic = "force-dynamic";
export const preferredRegion = ["iad1"];

// Stay under the public Base RPC's 10k eth_getLogs range limit.
const CHUNK_SIZE = 2_000;

const TRANSFER_TOPIC = id("Transfer(address,address,uint256)");

// Provider rotation (same pattern as b20-discovery / b20-client).
const providers: JsonRpcProvider[] = BASE_RPC_URLS.map(
  (url) => new JsonRpcProvider(url, 8453),
);
let cursor = 0;
async function rpcCall<T>(fn: (p: JsonRpcProvider) => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < Math.max(providers.length * 2, 2); attempt++) {
    const p = providers[cursor % providers.length] ?? getProvider();
    cursor = (cursor + 1) % Math.max(providers.length, 1);
    try {
      return await fn(p);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

export async function GET(request: NextRequest) {
  const fromBlock = parseInt(request.nextUrl.searchParams.get("fromBlock") || "");
  const toBlock = parseInt(request.nextUrl.searchParams.get("toBlock") || "");

  if (isNaN(fromBlock) || isNaN(toBlock) || fromBlock < 0 || toBlock < fromBlock) {
    return NextResponse.json({ error: "Invalid block range" }, { status: 400 });
  }

  // Cap range so a bad client can't request millions of blocks.
  if (toBlock - fromBlock > 20_000) {
    return NextResponse.json(
      { error: "Block range too large (max 20000)" },
      { status: 400 },
    );
  }

  const cache = cacheKey("events", fromBlock, toBlock);
  const cached = cacheGetSync<
    {
      topics: string[];
      data: string;
      blockNumber: number;
      txHash: string;
      logIndex: number;
      address: string;
    }[]
  >(cache);
  if (cached) return NextResponse.json(cached);

  try {
    const allLogs: {
      topics: string[];
      data: string;
      blockNumber: number;
      txHash: string;
      logIndex: number;
      address: string;
    }[] = [];

    for (let start = fromBlock; start <= toBlock; start += CHUNK_SIZE) {
      const end = Math.min(start + CHUNK_SIZE - 1, toBlock);
      try {
        const logs = await rpcCall((p) =>
          p.getLogs({
            fromBlock: start,
            toBlock: end,
            topics: [TRANSFER_TOPIC],
          }),
        );

        for (const log of logs) {
          if (!isB20Address(log.address)) continue;
          allLogs.push({
            topics: [...log.topics],
            data: log.data,
            blockNumber: Number(log.blockNumber),
            txHash: log.transactionHash ?? "",
            logIndex: Number(log.index),
            address: log.address,
          });
        }
      } catch (err) {
        // Skip chunk on transient RPC errors (rate limit / range) — don't fail whole request.
        console.error(`events chunk ${start}-${end} failed:`, err);
      }
    }

    cacheSetSync(cache, allLogs, TTL.TOKEN_EVENTS);
    return NextResponse.json(allLogs);
  } catch (err) {
    console.error("Events fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 },
    );
  }
}
