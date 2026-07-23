// app/api/events/stream/route.ts
// SSE stream of recent B20 Transfer events on Base Mainnet.
//
// Polls /api/block/current (shared 2s cache + provider rotation) for the chain
// head and /api/events for B20-filtered Transfer logs. The previous version
// polled eth_blockNumber every 2s directly against the public RPC and fetched
// ALL Transfer logs on Base unfiltered — that flood caused "-32016 over rate
// limit" errors.

import { NextRequest } from "next/server";
import { B20_ADDRESS_PREFIX } from "@/lib/constants";

const POLL_INTERVAL = 4_000;
const MAX_LOG_RANGE = 2_000;

function isB20Address(address: string): boolean {
  const a = address.toLowerCase();
  // Match ASSET (0xb200) and STABLECOIN (0xb201); exclude factory (0xb20f).
  return a.startsWith("0xb200") || a.startsWith("0xb201");
}

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const origin = new URL(request.url).origin;

  const stream = new ReadableStream({
    async start(controller) {
      let lastBlock = 0;
      const knownIds = new Set<string>();
      let inFlight = false;

      try {
        const res = await fetch(`${origin}/api/block/current`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as { blockNumber: number };
        lastBlock = Math.max(0, (j.blockNumber ?? 0) - 5);
      } catch {
        controller.enqueue(
          encoder.encode(`data: {"error":"Failed to get initial block"}\n\n`),
        );
        controller.close();
        return;
      }

      const tick = async () => {
        if (inFlight) return;
        inFlight = true;
        try {
          const res = await fetch(`${origin}/api/block/current`, {
            cache: "no-store",
          });
          if (!res.ok) return;
          const j = (await res.json()) as { blockNumber: number };
          const latestBlock = j.blockNumber;
          if (!latestBlock || latestBlock <= lastBlock) {
            controller.enqueue(
              encoder.encode(
                `data: {"type":"heartbeat","block":${latestBlock || lastBlock}}\n\n`,
              ),
            );
            return;
          }

          for (
            let from = lastBlock + 1;
            from <= latestBlock;
            from += MAX_LOG_RANGE
          ) {
            const to = Math.min(from + MAX_LOG_RANGE - 1, latestBlock);
            const logsRes = await fetch(
              `${origin}/api/events?fromBlock=${from}&toBlock=${to}`,
              { cache: "no-store" },
            );
            if (!logsRes.ok) continue;

            const logs = (await logsRes.json()) as Array<{
              address: string;
              topics: string[];
              data: string;
              blockNumber: number;
              txHash: string;
              logIndex: number;
            }>;

            if (!Array.isArray(logs)) continue;

            for (const log of logs) {
              if (!isB20Address(log.address)) continue;
              const id = `${log.txHash}-${log.logIndex}`;
              if (knownIds.has(id)) continue;
              knownIds.add(id);

              if (knownIds.size > 1000) {
                const arr = Array.from(knownIds);
                for (let i = 0; i < 500; i++) knownIds.delete(arr[i]);
              }

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    id,
                    address: log.address.toLowerCase(),
                    topics: log.topics,
                    data: log.data,
                    blockNumber: log.blockNumber,
                    txHash: log.txHash,
                    logIndex: log.logIndex,
                  })}\n\n`,
                ),
              );
            }
          }

          lastBlock = latestBlock;
          controller.enqueue(
            encoder.encode(
              `data: {"type":"heartbeat","block":${latestBlock}}\n\n`,
            ),
          );
        } catch (err) {
          console.error("SSE poll error:", err);
        } finally {
          inFlight = false;
        }
      };

      // First tick immediately, then on interval.
      void tick();
      const interval = setInterval(() => {
        void tick();
      }, POLL_INTERVAL);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
