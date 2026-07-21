// lib/data-sources.ts
// Configuration and utilities for data source management

import { B20_ADDRESS_PREFIX } from "./constants";

/**
 * Available data sources for B20 token discovery and market data
 */
export const DATA_SOURCES = {
  // Primary: Direct from B20 Factory contract
  FACTORY: {
    id: "factory",
    name: "B20 Factory Contract",
    description: "Direct integration with Base's official B20 Token Factory",
    requiresApiKey: false,
    realtime: true,
    reliability: "high",
    latency: "low",
  },
  
  // Secondary: Third-party DEX aggregators
  DEXSCREENER: {
    id: "dexscreener",
    name: "DexScreener",
    description: "Free DEX aggregator with comprehensive token data",
    requiresApiKey: false,
    realtime: true,
    reliability: "high",
    latency: "medium",
    baseUrl: "https://api.dexscreener.com",
  },
  
  GECKOTERMINAL: {
    id: "geckoterminal",
    name: "GeckoTerminal",
    description: "Free DEX analytics platform",
    requiresApiKey: false,
    realtime: true,
    reliability: "high",
    latency: "medium",
    baseUrl: "https://api.geckoterminal.com/api/v2",
  },
  
  // Market data providers
  BIRDEYE: {
    id: "birdeye",
    name: "Birdeye.so",
    description: "Comprehensive DeFi data aggregator",
    requiresApiKey: true,
    realtime: true,
    reliability: "high",
    latency: "low",
    baseUrl: "https://public-api.birdeye.so",
    apiKeyEnv: "BIRDEYE_API_KEY",
  },
  
  COINGECKO: {
    id: "coingecko",
    name: "CoinGecko",
    description: "Popular cryptocurrency data provider",
    requiresApiKey: false, // Free tier available
    realtime: true,
    reliability: "high",
    latency: "medium",
    baseUrl: "https://api.coingecko.com/api/v3",
    apiKeyEnv: "COINGECKO_API_KEY",
  },
  
  COINMARKETCAP: {
    id: "coinmarketcap",
    name: "CoinMarketCap",
    description: "Leading cryptocurrency market data provider",
    requiresApiKey: true,
    realtime: true,
    reliability: "high",
    latency: "medium",
    baseUrl: "https://pro-api.coinmarketcap.com",
    apiKeyEnv: "COINMARKETCAP_API_KEY",
  },
  
  // Fallback: Traditional block scanning
  BLOCK_SCAN: {
    id: "blockscan",
    name: "Block Scanning",
    description: "Traditional block-by-block scanning for B20 token discovery",
    requiresApiKey: false,
    realtime: false,
    reliability: "medium",
    latency: "high",
  },
} as const;

export type DataSourceId = keyof typeof DATA_SOURCES;
export type DataSourceConfig = (typeof DATA_SOURCES)[DataSourceId];

/**
 * Get the priority order for token discovery
 */
export const TOKEN_DISCOVERY_PRIORITY: DataSourceId[] = [
  "FACTORY",
  "DEXSCREENER", 
  "GECKOTERMINAL",
  "BLOCK_SCAN",
];

/**
 * Get the priority order for market data
 */
export const MARKET_DATA_PRIORITY: DataSourceId[] = [
  "DEXSCREENER",
  "GECKOTERMINAL", 
  "BIRDEYE",
  "COINGECKO",
  "COINMARKETCAP",
];

/**
 * Check if an address is a valid B20 token address
 */
export function isValidB20Address(address: string): boolean {
  if (!address || !address.startsWith("0x")) return false;
  return address.toLowerCase().startsWith(B20_ADDRESS_PREFIX.toLowerCase());
}

/**
 * Get the best available data source based on configuration
 */
export function getBestAvailableSource(sources: DataSourceId[]): DataSourceId | null {
  for (const sourceId of sources) {
    const source = DATA_SOURCES[sourceId];
    
    // If source doesn't require API key, it's available
    if (!source.requiresApiKey) {
      return sourceId;
    }
    
    // If source requires API key, check if it's configured
    const apiKey = process.env[source.apiKeyEnv!];
    if (apiKey && apiKey.trim() !== "") {
      return sourceId;
    }
  }
  
  return null;
}

/**
 * Get data source status information
 */
export function getDataSourceStatus() {
  const status: Record<DataSourceId, { available: boolean; reason?: string }> = {} as any;
  
  for (const [sourceId, config] of Object.entries(DATA_SOURCES)) {
    if (!config.requiresApiKey) {
      status[sourceId as DataSourceId] = { available: true };
    } else {
      const apiKey = process.env[config.apiKeyEnv!];
      if (apiKey && apiKey.trim() !== "") {
        status[sourceId as DataSourceId] = { available: true };
      } else {
        status[sourceId as DataSourceId] = { 
          available: false, 
          reason: `Missing ${config.apiKeyEnv} environment variable` 
        };
      }
    }
  }
  
  return status;
}

/**
 * Get health check endpoints for monitoring
 */
export function getHealthCheckEndpoints() {
  return {
    factory: "/api/factory-tokens?limit=1",
    thirdparty: "/api/thirdparty-tokens?limit=1",
    market: "/api/market?address=0xB20f000000000000000000000000000000000000",
    b20tokens: "/api/b20-tokens?limit=1",
  };
}
