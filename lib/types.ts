// B20 Token Tracker TypeScript Types

// ─── Aggregated Market Data (multi-source mashup) ───────────────────────────
export interface TokenMarketData {
  priceUsd: number | null;
  priceChange24h: number | null;
  marketCap: number | null;
  fdv: number | null;
  volume24h: number | null;
  volumeChange24h: number | null;
  liquidityUsd: number | null;
  liquidityChange24h: number | null;
  topPairAddress: string | null; // primary DEX pair for linking
  dexUrl: string | null; // direct link to DexScreener pair
  // Pair address resolved specifically from DexScreener (used for chart embeds).
  // topPairAddress may be a GeckoTerminal pool address, which won't embed in DexScreener.
  dexScreenerPairAddress: string | null;
  txns24h: { buys: number; sells: number } | null;
  holders: number | null;
  sourcePriority: MarketDataSource[]; // which sources returned data
  lastUpdated: number; // epoch ms
}

export type MarketDataSource =
  | "dexscreener"
  | "geckoterminal"
  | "birdeye"
  | "coingecko"
  | "coinmarketcap";

export interface B20Token {
  address: string;
  name: string;
  symbol: string;
  variant: "asset" | "stablecoin";
  decimals: number;
  currency?: string; // Stablecoin-only: e.g., "USD"
  totalSupply: bigint;
  supplyCap: bigint;
  creator: string;
  createdAt: number; // block timestamp
  txHash: string;
  isPaused: boolean;
  marketData?: TokenMarketData; // real-time market overlay
}

export type B20EventType =
  | "transfer"
  | "mint"
  | "burn"
  | "pause"
  | "unpause"
  | "role_granted"
  | "role_revoked"
  | "policy_updated"
  | "supply_cap_updated"
  | "name_updated"
  | "symbol_updated"
  | "b20_created"
  | "memo";

export interface B20Event {
  id: string; // unique key: txHash-logIndex
  type: B20EventType;
  tokenAddress: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  timestamp: number;

  // Transfer / Mint / Burn fields
  from?: string;
  to?: string;
  amount?: bigint;
  memo?: string;

  // Role fields
  role?: string;
  account?: string;

  // Supply cap fields
  oldCap?: bigint;
  newCap?: bigint;

  // B20Created fields
  variant?: number;
  creator?: string;
  salt?: string;

  // Token metadata (resolved)
  tokenName?: string;
  tokenSymbol?: string;
}

export interface B20Stats {
  totalTokens: number;
  totalAssetTokens: number;
  totalStablecoinTokens: number;
  totalSupply: bigint;
  totalMints: number;
  totalBurns: number;
  totalTransfers24h: number;
  pausedTokens: number;
}

export interface TokenHolder {
  address: string;
  balance: bigint;
  percentage: number;
}

export interface RoleAssignment {
  role: string;
  roleLabel: string;
  account: string;
}

export interface TokenDetail {
  token: B20Token;
  events: B20Event[];
  roles: RoleAssignment[];
  holders: TokenHolder[];
}

export interface CreatedTokenInfo {
  address: string;
  creator: string;
  variant: number;
  salt: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  timestamp: number;
  name?: string;
  symbol?: string;
}
