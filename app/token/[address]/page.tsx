// Server component with ISR (Incremental Static Regeneration)
// Pre-renders popular token pages at build time and caches them with revalidation

import { getProvider, isB20Address } from "@/lib/b20-server";
import { Contract, id } from "ethers";
import { B20_TOKEN_ABI } from "@/lib/constants";
import { cacheGetSync, cacheSetSync, cacheKey, TTL } from "@/lib/rpc-cache";
import { decodeTransferEvent } from "@/lib/event-decoder";
import TokenDetailContent from "@/components/TokenDetailContent";

// ISR: revalidate every 60 seconds
export const revalidate = 60;
export const dynamicParams = true;

// Pre-render known token addresses at build time
// These are the most commonly visited tokens
const POPULAR_TOKENS = [
  // B20 known tokens will be discovered at runtime via ISR
  // Static pre-render for the factory address itself (won't be a token page)
];

export async function generateStaticParams() {
  // Since tokens change frequently, we don't pre-render any at build time.
  // All token pages will be generated on first visit and cached via ISR.
  return [];
}

// ─── Fetch initial data on the server ─────────────────────────────────────

interface TokenMeta {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  currency?: string;
}

interface RawEvent {
  topics: string[];
  data: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  address?: string;
}

async function fetchMetadata(address: string): Promise<TokenMeta | null> {
  const cache = cacheKey("metadata", "isr", address.toLowerCase());
  const cached = cacheGetSync<Omit<TokenMeta, "totalSupply"> & { totalSupply: string }>(cache);
  if (cached) {
    return { ...cached, totalSupply: BigInt(cached.totalSupply) };
  }

  try {
    const provider = getProvider();
    const contract = new Contract(address, B20_TOKEN_ABI, provider);

    const [name, symbol, decimals, totalSupply] = await Promise.all([
      contract.name.staticCall().catch(() => "Unknown"),
      contract.symbol.staticCall().catch(() => "???"),
      contract.decimals.staticCall().catch(() => BigInt(18)),
      contract.totalSupply.staticCall().catch(() => BigInt(0)),
    ]);

    let currency: string | undefined;
    try {
      currency = await contract.currency.staticCall();
    } catch {
      // not a stablecoin
    }

    const result = {
      name: String(name || "Unknown"),
      symbol: String(symbol || "???"),
      decimals: Number(decimals) || 18,
      totalSupply: BigInt(totalSupply.toString()),
      currency,
    };

    // Cache sync for hot reads
    cacheSetSync(cache, { ...result, totalSupply: totalSupply.toString() }, TTL.TOKEN_METADATA);

    return result;
  } catch (err) {
    console.error("ISR metadata fetch error:", err);
    return null;
  }
}

// ─── Serializable event shape (no BigInt — strings only for RSC boundary) ──
interface SerializableEvent {
  id: string;
  type: string;
  from: string;
  to: string;
  tokenAddress: string;
  amount: string; // BigInt as string
  blockNumber: number;
  txHash: string;
  logIndex: number;
  timestamp: number;
}

/**
 * Fetch and decode token events on the server.
 * Returns events with amount as string (BigInt is not serializable through RSC).
 */
async function fetchEvents(address: string): Promise<SerializableEvent[]> {
  const provider = getProvider();
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, currentBlock - 5000);
  const transferTopic = id("Transfer(address,address,uint256)");

  try {
    const logs = await provider.getLogs({
      fromBlock,
      toBlock: currentBlock,
      address,
      topics: [transferTopic],
    });

    const events: SerializableEvent[] = [];
    for (const log of logs.slice(0, 50)) {
      const decoded = decodeTransferEvent({
        topics: [...log.topics],
        data: log.data,
        blockNumber: Number(log.blockNumber),
        txHash: log.transactionHash ?? "",
        logIndex: Number(log.index),
        address,
      });
      if (!decoded) continue;

      events.push({
        id: decoded.id,
        type: decoded.type,
        from: decoded.from || "",
        to: decoded.to || "",
        tokenAddress: decoded.tokenAddress,
        amount: (decoded.amount || BigInt(0)).toString(), // serialize BigInt → string
        blockNumber: decoded.blockNumber,
        txHash: decoded.txHash,
        logIndex: decoded.logIndex,
        timestamp: decoded.timestamp,
      });
    }

    // Sort newest first
    events.sort((a, b) => b.blockNumber - a.blockNumber);
    return events.slice(0, 100);
  } catch {
    return [];
  }
}

// ─── Page Component ──────────────────────────────────────────────────────

export default async function TokenDetailISRPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const addr = address.toLowerCase();

  // Validate address format
  if (!addr || !isB20Address(addr)) {
    return (
      <TokenDetailContent
        address={addr}
        initialMetadata={null}
        initialEvents={[]}
      />
    );
  }

  // Fetch initial data server-side (ISR-cached)
  const [metadata, events] = await Promise.all([
    fetchMetadata(addr),
    fetchEvents(addr),
  ]);

  // Serialize metadata: BigInt → string for safe RSC serialization
  const serializedMeta = metadata
    ? { ...metadata, totalSupply: metadata.totalSupply.toString() }
    : null;

  return (
    <TokenDetailContent
      address={addr}
      initialMetadata={serializedMeta as any}
      initialEvents={events as any}
    />
  );
}
