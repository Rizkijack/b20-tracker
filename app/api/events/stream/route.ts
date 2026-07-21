import { NextRequest } from "next/server";
import { BASE_MAINNET_RPC } from "@/lib/constants";

const FACTORY_ADDRESS = "0x0b8a76d3e63f6e8e3d8e8e8e8e8e8e8e8e8e8e8e".toLowerCase(); // will be replaced with actual factory

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let lastBlock = 0;
      const knownIds = new Set<string>();
      
      // Get initial block
      try {
        const res = await fetch(BASE_MAINNET_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_blockNumber",
            params: [],
          }),
        });
        const data = await res.json();
        lastBlock = parseInt(data.result, 16) - 5;
      } catch (err) {
        controller.enqueue(encoder.encode(`data: {"error":"Failed to get initial block"}\n\n`));
        controller.close();
        return;
      }

      // Poll every 2 seconds (faster than client-side 4s)
      const interval = setInterval(async () => {
        try {
          // Get latest block
          const res = await fetch(BASE_MAINNET_RPC, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "eth_blockNumber",
              params: [],
            }),
          });
          const data = await res.json();
          const latestBlock = parseInt(data.result, 16);
          
          if (latestBlock > lastBlock) {
            // Fetch logs for new blocks
            const fromBlock = lastBlock + 1;
            const toBlock = latestBlock;
            
            const logsRes = await fetch(BASE_MAINNET_RPC, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "eth_getLogs",
                params: [{
                  fromBlock: `0x${fromBlock.toString(16)}`,
                  toBlock: `0x${toBlock.toString(16)}`,
                  topics: [
                    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", // Transfer
                  ],
                }],
              }),
            });
            const logsData = await logsRes.json();
            const logs = logsData.result || [];
            
            for (const log of logs) {
              const id = `${log.transactionHash}-${log.logIndex}`;
              if (knownIds.has(id)) continue;
              knownIds.add(id);
              
              // Clean up old IDs to prevent memory leak
              if (knownIds.size > 1000) {
                const arr = Array.from(knownIds);
                for (let i = 0; i < 500; i++) knownIds.delete(arr[i]);
              }
              
              const event = {
                id,
                address: log.address.toLowerCase(),
                topics: log.topics,
                data: log.data,
                blockNumber: parseInt(log.blockNumber, 16),
                txHash: log.transactionHash,
                logIndex: parseInt(log.logIndex, 16),
              };
              
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            }
            
            lastBlock = latestBlock;
            
            // Send heartbeat with current block
            controller.enqueue(encoder.encode(`data: {"type":"heartbeat","block":${latestBlock}}\n\n`));
          }
        } catch (err) {
          console.error("SSE poll error:", err);
        }
      }, 2000);

      // Cleanup on client disconnect
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
