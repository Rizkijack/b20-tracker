import { JsonRpcProvider, Contract, Interface, id } from "ethers";
import {
  BASE_MAINNET_RPC,
  B20_FACTORY_ADDRESS,
  B20_TOKEN_ABI,
  B20_ADDRESS_PREFIX,
  B20Variant,
} from "./constants";
import type { B20Token, B20Event } from "./types";

// Singleton provider
let provider: JsonRpcProvider | null = null;

export function getProvider(): JsonRpcProvider {
  if (!provider) {
    provider = new JsonRpcProvider(BASE_MAINNET_RPC, 8453); // Base chainId
  }
  return provider;
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
  const provider = getProvider();
  const block = await provider.getBlock(blockNumber);
  return block ? block.timestamp : Math.floor(Date.now() / 1000);
}

// ─── Helper: Get current block number ──────────────────────────────────────
export async function getCurrentBlockNumber(): Promise<number> {
  const provider = getProvider();
  return await provider.getBlockNumber();
}

// ─── Fetch token metadata ───────────────────────────────────────────────────
export async function fetchTokenMetadata(address: string): Promise<{
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  currency?: string;
}> {
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

    return {
      name: name || "Unknown",
      symbol: symbol || "???",
      decimals: Number(decimals) || 18,
      totalSupply: totalSupply ?? BigInt(0),
      currency,
    };
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
  const provider = getProvider();

  // Use Transfer event topic to find all token activity
  const transferTopic = id("Transfer(address,address,uint256)");

  // Scan in chunks of 2000 blocks (Base has 2-second blocks)
  const CHUNK_SIZE = 2000;
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
  const provider = getProvider();
  const transferTopic = id("Transfer(address,address,uint256)");

  try {
    const logs = await provider.getLogs({
      fromBlock,
      toBlock,
      address: tokenAddress,
      topics: [transferTopic],
    });

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

// ─── Fetch Transfer events across all B20 tokens in a block range ───────────
export async function fetchRecentB20Transfers(
  fromBlock: number,
  toBlock: number,
): Promise<{ topics: string[]; data: string; blockNumber: number; txHash: string; logIndex: number; address: string }[]> {
  const provider = getProvider();
  const transferTopic = id("Transfer(address,address,uint256)");

  const CHUNK_SIZE = 2000;
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
    } catch (err) {
      console.error(`Error fetching transfers in blocks ${start}-${end}:`, err);
    }
  }

  return allLogs;
}

// ─── Detect token variant from address ─────────────────────────────────────
// B20 address: [0xB20f prefix (10 bytes)] [variant byte (1 byte)] [bytes9(keccak256(...))]
export function detectVariant(address: string): "asset" | "stablecoin" {
  // The variant byte is at position 10 (20th hex char, after 0xB20f = 4 bytes prefix)
  // Full B20 prefix is 10 bytes = 20 hex chars: 0xB20f0000000000000000000000
  // Variant is encoded at address[10] position
  try {
    const cleaned = address.toLowerCase().replace("0x", "");
    // B20 addresses: bytes 0-9 are prefix, byte 10 is variant
    // "b20f00000000000000000000" = 22 hex chars (11 bytes), variant at byte 10 = hex chars 20-21
    if (cleaned.length >= 22) {
      const variantHex = cleaned.slice(20, 22);
      const variantInt = parseInt(variantHex, 16);
      return variantInt === B20Variant.STABLECOIN ? "stablecoin" : "asset";
    }
  } catch {
    // ignore
  }
  return "asset";
}
