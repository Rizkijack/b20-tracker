// Client-side API functions that proxy RPC calls through Next.js API routes
// This keeps RPC endpoints hidden from the browser and reduces rate limiting

// ─── Types for API responses ─────────────────────────────────────────────

interface TokenMetaResponse {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  currency?: string;
}

interface BlockResponse {
  blockNumber: number;
}

interface TimestampResponse {
  timestamp: number;
}

interface RawLog {
  topics: string[];
  data: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  address?: string;
}

// ─── Generic fetch with error handling ───────────────────────────────────

async function fetchApi<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }
  return res.json();
}

// ─── Get current block number ────────────────────────────────────────────

export async function getCurrentBlockNumber(): Promise<number> {
  const data = await fetchApi<BlockResponse>("/api/block/current");
  return data.blockNumber;
}

// ─── Get block timestamp ────────────────────────────────────────────────

export async function getBlockTimestamp(blockNumber: number): Promise<number> {
  const data = await fetchApi<TimestampResponse>(
    `/api/block/timestamp?blockNumber=${blockNumber}`,
  );
  return data.timestamp;
}

// ─── Fetch token metadata ────────────────────────────────────────────────

export async function fetchTokenMetadata(address: string): Promise<{
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  currency?: string;
}> {
  const data = await fetchApi<TokenMetaResponse>(
    `/api/metadata?address=${encodeURIComponent(address)}`,
  );
  return {
    name: data.name,
    symbol: data.symbol,
    decimals: data.decimals,
    totalSupply: BigInt(data.totalSupply || "0"),
    currency: data.currency,
  };
}

// ─── Discover B20 tokens ─────────────────────────────────────────────────

export async function discoverB20Tokens(
  fromBlock: number,
  toBlock: number,
): Promise<{ address: string; blockNumber: number; txHash: string }[]> {
  return fetchApi<{ address: string; blockNumber: number; txHash: string }[]>(
    `/api/discover?fromBlock=${fromBlock}&toBlock=${toBlock}`,
  );
}

// ─── Fetch recent B20 transfers across all tokens ────────────────────────

export async function fetchRecentB20Transfers(
  fromBlock: number,
  toBlock: number,
): Promise<{ topics: string[]; data: string; blockNumber: number; txHash: string; logIndex: number; address: string }[]> {
  const logs = await fetchApi<RawLog[]>(
    `/api/events?fromBlock=${fromBlock}&toBlock=${toBlock}`,
  );
  // Ensure address field is present
  return logs.map((log) => ({
    ...log,
    address: log.address || "",
  }));
}

// ─── Fetch events for a specific token ───────────────────────────────────

export async function fetchTokenEvents(
  tokenAddress: string,
  fromBlock: number,
  toBlock: number,
): Promise<{ topics: string[]; data: string; blockNumber: number; txHash: string; logIndex: number }[]> {
  return fetchApi<RawLog[]>(
    `/api/token-events?address=${encodeURIComponent(tokenAddress)}&fromBlock=${fromBlock}&toBlock=${toBlock}`,
  );
}
