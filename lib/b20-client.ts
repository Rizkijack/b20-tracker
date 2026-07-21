// lib/b20-client.ts
// Shared ethers.js provider & blockchain utilities.
//
// ⚠️ This file is imported by BOTH server-side (API routes) AND client-side code.
// - Server-side: getProvider() returns a JsonRpcProvider for direct RPC calls.
// - Client-side: api-client.ts proxies through Next.js API routes to hide RPC URLs.
//
// Do NOT add server-only env vars (API keys, Redis URLs) to this file.
// Server-only logic lives in lib/market-data.ts, lib/server-cache.ts, etc.

import { JsonRpcProvider, Contract, id } from "ethers";
import {
  BASE_RPC_URLS,
  B20_TOKEN_ABI,
  B20_ADDRESS_PREFIX,
  B20Variant,
  ALL_B20_EVENT_TOPICS,
} from "./constants";
import { cacheGet, cacheSet, TTL } from "./server-cache";

// Singleton provider(s) — one per configured RPC URL for rotation on rate limits.
const providers: JsonRpcProvider[] = BASE_RPC_URLS.map(
  (url) => new JsonRpcProvider(url, 8453), // Base chainId
);

let providerCursor = 0;
function nextProvider(): JsonRpcProvider {
  const p = providers[providerCursor % providers.length];
  providerCursor = (providerCursor + 1) % providers.length;
  return p;
}

export function getProvider(): JsonRpcProvider {
  return providers[0];
}

// Run an RPC call against providers with rotation + retry on transient failures.
async function rpcCall<T>(fn: (p: JsonRpcProvider) => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < providers.length * 2; attempt++) {
    const p = nextProvider();
    try {
      return await fn(p);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

// ─── Helper: Check if address is a B20 token ───────────────────────────────
export function isB20Address(address: string): boolean {
  return address.toLowerCase().startsWith(B20_ADDRESS_PREFIX.toLowerCase());
}

// ─── Helper: Truncate address for display ──────────────────────────────────
export function truncateAddress(address: string, chars = 6): string {
  if (!address) return "";
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// ─── Helper: Format token amount with decimals ────────────────────────────
export function formatAmount(amount: bigint, decimals: number): string {
  if (amount === BigInt(0)) return "0";
  const divisor = BigInt(10 ** decimals);
  const integer = amount / divisor;
  const fractional = amount % divisor;
  if (fractional === BigInt(0)) {
    return integer.toLocaleString();
  }
  const fractionalStr = fractional.toString().padStart(decimals, "0").slice(0, 4);
  return `${integer.toLocaleString()}.${fractionalStr}`;
}

// ─── Helper: Format large numbers ───────────────────────────────────────────
export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

// ─── Helper: Get block timestamp ────────────────────────────────────────────
export async function getBlockTimestamp(blockNumber: number): Promise<number> {
  const cacheKey = `blk:${blockNumber}`;
  const cached = await cacheGet<number>(cacheKey);
  if (cached !== null) return cached;

  const block = await rpcCall((p) => p.getBlock(blockNumber));
  const ts = block ? block.timestamp : Math.floor(Date.now() / 1000);
  await cacheSet(cacheKey, ts, TTL.BLOCK);
  return ts;
}

// ─── Helper: Get current block number ──────────────────────────────────────
export async function getCurrentBlockNumber(): Promise<number> {
  const cached = await cacheGet<number>("block:latest");
  if (cached !== null) return cached;

  const blockNumber = await rpcCall((p) => p.getBlockNumber());
  // Block height changes every ~2s; short TTL keeps us fresh without
  // hammering the RPC on every poll.
  await cacheSet("block:latest", blockNumber, TTL.BLOCK);
  return blockNumber;
}

// ─── Fetch token metadata ───────────────────────────────────────────────────
export async function fetchTokenMetadata(address: string): Promise<{
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  currency?: string;
}> {
  const cacheKey = `meta:${address.toLowerCase()}`;
  const cached = await cacheGet<{
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
    currency?: string;
  }>(cacheKey);

  if (cached) {
    return {
      name: cached.name,
      symbol: cached.symbol,
      decimals: cached.decimals,
      totalSupply: BigInt(cached.totalSupply),
      currency: cached.currency,
    };
  }

  const provider = getProvider();
  const contract = new Contract(address, B20_TOKEN_ABI, provider);

  try {
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      contract.name.staticCall(),
      contract.symbol.staticCall(),
      contract.decimals.staticCall().catch(() => 18),
      contract.totalSupply.staticCall(),
    ]);

    let currency: string | undefined;
    try {
      currency = await contract.currency.staticCall();
    } catch {
      // Not a stablecoin, currency() will revert
    }

    const result = {
      name: name || "Unknown",
      symbol: symbol || "???",
      decimals: Number(decimals) || 18,
      totalSupply: totalSupply ?? BigInt(0),
      currency,
    };
    await cacheSet(cacheKey, { ...result, totalSupply: result.totalSupply.toString() }, TTL.TOKEN_METADATA);
    return result;
  } catch {
    return {
      name: "Unknown",
      symbol: "???",
      decimals: 18,
      totalSupply: BigInt(0),
    };
  }
}

// ─── Fetch balance for a token ─────────────────────────────────────────────
export async function fetchTokenBalance(tokenAddress: string, walletAddress: string): Promise<bigint> {
  const provider = getProvider();
  const contract = new Contract(tokenAddress, B20_TOKEN_ABI, provider);
  try {
    return await contract.balanceOf.staticCall(walletAddress);
  } catch {
    return BigInt(0);
  }
}

// ─── Discover all B20 tokens from logs ─────────────────────────────────────
// Scans Transfer events from B20-prefixed addresses in recent blocks
export async function discoverB20Tokens(
  fromBlock: number,
  toBlock: number,
): Promise<{ address: string; blockNumber: number; txHash: string }[]> {
  const transferTopic = id("Transfer(address,address,uint256)");

  // Scan in chunks of 2000 blocks (Base has 2-second blocks)
  const CHUNK_SIZE = 2000;
  const tokens: { address: string; blockNumber: number; txHash: string }[] = [];
  const seen = new Set<string>();

  for (let start = fromBlock; start <= toBlock; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE - 1, toBlock);
    try {
      const logs = await rpcCall((p) =>
        p.getLogs({
          fromBlock: start,
          toBlock: end,
          topics: [transferTopic],
        }),
      );

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
    } catch (err) {
      console.error(`Error scanning blocks ${start}-${end}:`, err);
    }
  }

  return tokens;
}

// ─── Fetch recent events for a specific B20 token ───────────────────────────
export async function fetchTokenEvents(
  tokenAddress: string,
  fromBlock: number,
  toBlock: number,
): Promise<{ topics: string[]; data: string; blockNumber: number; txHash: string; logIndex: number }[]> {
  const transferTopic = id("Transfer(address,address,uint256)");

  try {
    const logs = await rpcCall((p) =>
      p.getLogs({
        fromBlock,
        toBlock,
        address: tokenAddress,
        topics: [transferTopic],
      }),
    );

    return logs.map((log) => ({
      topics: [...log.topics],
      data: log.data,
      blockNumber: Number(log.blockNumber),
      txHash: log.transactionHash ?? "",
      logIndex: Number(log.index),
    }));
  } catch {
    return [];
  }
}

// ─── Fetch ALL B20 events (transfer, memo, roles, pause, supply cap, …) ──────
export async function fetchTokenAllEvents(
  tokenAddress: string,
  fromBlock: number,
  toBlock: number,
): Promise<{ topics: string[]; data: string; blockNumber: number; txHash: string; logIndex: number; address: string }[]> {
  try {
    const logs = await rpcCall((p) =>
      p.getLogs({
        fromBlock,
        toBlock,
        address: tokenAddress,
        topics: [ALL_B20_EVENT_TOPICS],
      }),
    );

    return logs.map((log) => ({
      topics: [...log.topics],
      data: log.data,
      blockNumber: Number(log.blockNumber),
      txHash: log.transactionHash ?? "",
      logIndex: Number(log.index),
      address: log.address,
    }));
  } catch {
    return [];
  }
}

// ─── Fetch Transfer events across all B20 tokens in a block range ───────────
export async function fetchRecentB20Transfers(
  fromBlock: number,
  toBlock: number,
): Promise<{ topics: string[]; data: string; blockNumber: number; txHash: string; logIndex: number; address: string }[]> {
  const transferTopic = id("Transfer(address,address,uint256)");

  const CHUNK_SIZE = 2000;
  const allLogs: { topics: string[]; data: string; blockNumber: number; txHash: string; logIndex: number; address: string }[] = [];

  for (let start = fromBlock; start <= toBlock; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE - 1, toBlock);
    try {
      const logs = await rpcCall((p) =>
        p.getLogs({
          fromBlock: start,
          toBlock: end,
          topics: [transferTopic],
        }),
      );

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
    } catch (err) {
      console.error(`Error fetching transfers in blocks ${start}-${end}:`, err);
    }
  }

  return allLogs;
}

// ─── Detect token variant from address ─────────────────────────────────────
// Canonical B20 layout: 0xB20f + 9 zero bytes (10-byte prefix) + 1 variant byte
// + 9-byte keccak256 suffix = 20 bytes / 40 hex chars. The variant byte sits at
// hex positions [20,22) (byte 10). ASSET = 0x00, STABLECOIN = 0x01.
export function detectVariant(address: string): "asset" | "stablecoin" {
  const cleaned = address.toLowerCase().replace("0x", "");
  // A full B20 address is 40 hex chars; anything shorter is not a valid B20 address.
  if (cleaned.length < 40) return "asset";
  const variantInt = parseInt(cleaned.slice(20, 22), 16);
  return variantInt === B20Variant.STABLECOIN ? "stablecoin" : "asset";
}
