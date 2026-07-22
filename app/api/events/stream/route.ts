import { NextRequest } from "next/server";
import { rpcCall, getCurrentBlockNumber } from "@/lib/b20-client";
import { cacheGet, cacheSet, TTL } from "@/lib/server-cache";
import { EVENT_TOPICS, B20_ADDRESS_PREFIX } from "@/lib/constants";

const POLL_INTERVAL_MS = 4_000;
const MAX_BLOCK_RANGE = 200;

function isB20(addr: string): boolean {
  return addr.toLowerCase().startsWith(B20_ADDRESS_PREFIX.toLowerCase());
}

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let lastBlock = 0;
      const knownIds = new Set<string>();

      try {
        lastBlock = Math.max(0, (await getCurrentBlockNumber()) - 5);
      } catch (err) {
        controller.enqueue(encoder.encode(`data: {"error":"Failed to get initial block"}\n\n`));
        controller.close();
        return;
      }

      const interval = setInterval(async () => {
        try {
          const latestBlock = await getCurrentBlockNumber();
          if (latestBlock <= lastBlock) return;

          const fromBlock = lastBlock + 1;
          const toBlock = Math.min(latestBlock, fromBlock + MAX_BLOCK_RANGE - 1);

          const logs = await rpcCall((p) =>
            p.getLogs({
              fromBlock,
              toBlock,
              topics: [EVENT_TOPICS.TRANSFER],
            }),
          );

          for (const log of logs) {
            if (!isB20(log.address)) continue;

            const id = `${log.transactionHash}-${log.index}`;
            if (knownIds.has(id)) continue;
            knownIds.add(id);

            if (knownIds.size > 1000) {
              const arr = Array.from(knownIds);
              for (let i = 0; i < 500; i++) knownIds.delete(arr[i]);
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              id,
              address: log.address.toLowerCase(),
              topics: log.topics,
              data: log.data,
              blockNumber: Number(log.blockNumber),
              txHash: log.transactionHash,
              logIndex: Number(log.index),
            })}\n\n`));
          }

          lastBlock = toBlock;
          controller.enqueue(encoder.encode(`data: {"type":"heartbeat","block":${latestBlock}}\n\n`));
        } catch (err) {
          console.error("SSE poll error:", err);
        }
      }, POLL_INTERVAL_MS);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
