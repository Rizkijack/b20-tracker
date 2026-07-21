// lib/b20-factory.ts
// Direct integration with B20 Token Factory on Base Mainnet
// This provides real-time discovery of B20 tokens without block scanning

import { Contract, JsonRpcProvider, id } from "ethers";
import { 
  B20_FACTORY_ADDRESS, 
  B20_FACTORY_ABI,
  B20_ADDRESS_PREFIX,
  BASE_RPC_URLS 
} from "./constants";
import { cacheGet, cacheSet, TTL } from "./server-cache";
import type { B20Token } from "./types";

// Cache key for factory-based token discovery
const FACTORY_TOKENS_CACHE_KEY = "b20:factory:tokens";
const FACTORY_EVENTS_CACHE_KEY = "b20:factory:events";

// Singleton provider for factory calls
function getFactoryProvider(): JsonRpcProvider {
  return new JsonRpcProvider(BASE_RPC_URLS[0], 8453);
}

/**
 * Get all B20 tokens created through the factory
 * Uses the factory's event logs to discover tokens efficiently
 */
export async function getB20TokensFromFactory(
  limit: number = 1000,
  fromBlock: number = 0
): Promise<{ address: string; creator: string; variant: number; salt: string; blockNumber: number; txHash: string }[]> {
  const cacheKey = `${FACTORY_TOKENS_CACHE_KEY}:${limit}:${fromBlock}`;
  
  // Try cache first
  const cached = await cacheGet<{ address: string; creator: string; variant: number; salt: string; blockNumber: number; txHash: string }[]>(cacheKey);
  if (cached) return cached;

  try {
    const provider = getFactoryProvider();
    const factoryContract = new Contract(B20_FACTORY_ADDRESS, B20_FACTORY_ABI, provider);
    
    // Get B20Created events from the factory
    const b20CreatedTopic = id("B20Created(address,address,uint8,bytes32)");
    
    const currentBlock = await provider.getBlockNumber();
    const startBlock = fromBlock > 0 ? fromBlock : Math.max(0, currentBlock - 100000); // Scan last 100k blocks by default
    
    const tokens: { address: string; creator: string; variant: number; salt: string; blockNumber: number; txHash: string }[] = [];
    const seen = new Set<string>();
    
    // Scan in chunks to avoid RPC limits
    const CHUNK_SIZE = 5000;
    for (let block = startBlock; block <= currentBlock && tokens.length < limit; block += CHUNK_SIZE) {
      const endBlock = Math.min(block + CHUNK_SIZE - 1, currentBlock);
      
      try {
        const logs = await provider.getLogs({
          fromBlock: block,
          toBlock: endBlock,
          address: B20_FACTORY_ADDRESS,
          topics: [b20CreatedTopic],
        });
        
        for (const log of logs) {
          if (log.topics.length >= 4 && log.address.toLowerCase() === B20_FACTORY_ADDRESS.toLowerCase()) {
            const tokenAddress = `0x${log.topics[1].slice(-40)}`;
            const creator = `0x${log.topics[2].slice(-40)}`;
            const variant = Number(BigInt(log.topics[3]));
            
            // Extract salt and other params from log data
            const salt = log.data.slice(0, 66); // First 32 bytes as hex string
            const txHash = log.transactionHash || "";
            const blockNumber = Number(log.blockNumber);
            
            if (!seen.has(tokenAddress.toLowerCase()) && 
                tokenAddress.toLowerCase().startsWith(B20_ADDRESS_PREFIX.toLowerCase())) {
              seen.add(tokenAddress.toLowerCase());
              tokens.push({
                address: tokenAddress,
                creator,
                variant,
                salt,
                blockNumber,
                txHash,
              });
              
              if (tokens.length >= limit) break;
            }
          }
        }
        
        if (tokens.length >= limit) break;
      } catch (error) {
        console.error(`Error fetching factory logs for blocks ${block}-${endBlock}:`, error);
        // Continue with next chunk
      }
    }
    
    // Cache for 5 minutes
    await cacheSet(cacheKey, tokens, TTL.TOKEN_DISCOVERY);
    return tokens;
  } catch (error) {
    console.error("Error fetching B20 tokens from factory:", error);
    return [];
  }
}

/**
 * Get B20 tokens from factory with metadata
 * Combines factory data with on-chain metadata
 */
export async function getB20TokensWithMetadata(
  limit: number = 500
): Promise<B20Token[]> {
  const factoryTokens = await getB20TokensFromFactory(limit);
  const tokens: B20Token[] = [];
  
  for (const factoryToken of factoryTokens) {
    try {
      // Try to get basic metadata from the token contract
      const provider = getFactoryProvider();
      const tokenContract = new Contract(factoryToken.address, [
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
        "function totalSupply() view returns (uint256)",
        "function currency() view returns (string)",
      ], provider);
      
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        tokenContract.name.staticCall().catch(() => "Unknown"),
        tokenContract.symbol.staticCall().catch(() => "???"),
        tokenContract.decimals.staticCall().catch(() => 18),
        tokenContract.totalSupply.staticCall().catch(() => BigInt(0)),
      ]);
      
      let currency: string | undefined;
      try {
        currency = await tokenContract.currency.staticCall();
      } catch {
        // Not a stablecoin
      }
      
      const variant = factoryToken.variant === 1 ? "stablecoin" : "asset";
      const blockTimestamp = await getBlockTimestamp(factoryToken.blockNumber);
      
      tokens.push({
        address: factoryToken.address,
        name: name || "Unknown",
        symbol: symbol || "???",
        variant,
        decimals: Number(decimals) || 18,
        currency,
        totalSupply: totalSupply ?? BigInt(0),
        supplyCap: BigInt(0),
        creator: factoryToken.creator,
        createdAt: blockTimestamp,
        txHash: factoryToken.txHash,
        isPaused: false,
      });
    } catch (error) {
      console.error(`Error fetching metadata for ${factoryToken.address}:`, error);
      // Skip this token
    }
  }
  
  return tokens;
}

/**
 * Get block timestamp (helper function)
 */
async function getBlockTimestamp(blockNumber: number): Promise<number> {
  const cacheKey = `blk:${blockNumber}`;
  const cached = await cacheGet<number>(cacheKey);
  if (cached !== null) return cached;

  const provider = getFactoryProvider();
  const block = await provider.getBlock(blockNumber);
  const ts = block ? block.timestamp : Math.floor(Date.now() / 1000);
  await cacheSet(cacheKey, ts, TTL.BLOCK);
  return ts;
}

/**
 * Stream new B20 tokens from factory events in real-time
 * Uses WebSocket connection for real-time updates
 */
export async function* streamB20FactoryEvents(
  fromBlock: number = 0
): AsyncGenerator<{ 
  address: string; 
  creator: string; 
  variant: number; 
  salt: string; 
  blockNumber: number; 
  txHash: string; 
  timestamp: number 
}> {
  const provider = new JsonRpcProvider(BASE_RPC_URLS[0], 8453);
  const factoryContract = new Contract(B20_FACTORY_ADDRESS, B20_FACTORY_ABI, provider);
  
  const b20CreatedTopic = id("B20Created(address,address,uint8,bytes32)");
  
  // First, yield existing tokens from recent blocks
  const existingTokens = await getB20TokensFromFactory(100, fromBlock);
  for (const token of existingTokens) {
    const timestamp = await getBlockTimestamp(token.blockNumber);
    yield {
      ...token,
      timestamp,
    };
  }
  
  // Note: For true real-time streaming, you would need a WebSocket provider
  // This is a simplified version that polls for new events
  let lastBlock = fromBlock;
  
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
    
    try {
      const currentBlock = await provider.getBlockNumber();
      if (currentBlock <= lastBlock) continue;
      
      const logs = await provider.getLogs({
        fromBlock: lastBlock + 1,
        toBlock: currentBlock,
        address: B20_FACTORY_ADDRESS,
        topics: [b20CreatedTopic],
      });
      
      for (const log of logs) {
        if (log.topics.length >= 4) {
          const tokenAddress = `0x${log.topics[1].slice(-40)}`;
          const creator = `0x${log.topics[2].slice(-40)}`;
          const variant = Number(BigInt(log.topics[3]));
          const salt = log.data.slice(0, 66);
          const txHash = log.transactionHash || "";
          const blockNumber = Number(log.blockNumber);
          const timestamp = await getBlockTimestamp(blockNumber);
          
          if (tokenAddress.toLowerCase().startsWith(B20_ADDRESS_PREFIX.toLowerCase())) {
            yield {
              address: tokenAddress,
              creator,
              variant,
              salt,
              blockNumber,
              txHash,
              timestamp,
            };
          }
        }
      }
      
      lastBlock = currentBlock;
    } catch (error) {
      console.error("Error in factory event stream:", error);
    }
  }
}

/**
 * Fallback: Fetch B20 tokens from third-party APIs
 * Uses DexScreener and GeckoTerminal to discover tokens
 */
export async function fetchB20TokensFromThirdParty(
  limit: number = 100
): Promise<{ address: string; name: string; symbol: string; variant: "asset" | "stablecoin" }[]> {
  const tokens: { address: string; name: string; symbol: string; variant: "asset" | "stablecoin" }[] = [];
  const seen = new Set<string>();
  
  // Try DexScreener first - get top tokens on Base
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/base?limit=${limit}`,
      { next: { revalidate: 30 } }
    );
    
    if (response.ok) {
      const data = await response.json();
      const pairs = data.pairs || [];
      
      for (const pair of pairs) {
        const baseToken = pair.baseToken || {};
        const quoteToken = pair.quoteToken || {};
        
        [baseToken, quoteToken].forEach(token => {
          if (token.address && token.address.toLowerCase().startsWith(B20_ADDRESS_PREFIX.toLowerCase())) {
            const addr = token.address.toLowerCase();
            if (!seen.has(addr)) {
              seen.add(addr);
              tokens.push({
                address: token.address,
                name: token.name || "Unknown",
                symbol: token.symbol || "???",
                variant: detectVariantFromAddress(token.address),
              });
            }
          }
        });
      }
    }
  } catch (error) {
    console.error("Error fetching from DexScreener:", error);
  }
  
  // Try GeckoTerminal as fallback
  if (tokens.length < limit / 2) {
    try {
      const response = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/base/tokens?page=1&per_page=${limit}`,
        { next: { revalidate: 30 } }
      );
      
      if (response.ok) {
        const data = await response.json();
        const tokenData = data.data || [];
        
        for (const item of tokenData) {
          const attributes = item.attributes || {};
          if (attributes.address && attributes.address.toLowerCase().startsWith(B20_ADDRESS_PREFIX.toLowerCase())) {
            const addr = attributes.address.toLowerCase();
            if (!seen.has(addr)) {
              seen.add(addr);
              tokens.push({
                address: attributes.address,
                name: attributes.name || "Unknown",
                symbol: attributes.symbol || "???",
                variant: detectVariantFromAddress(attributes.address),
              });
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching from GeckoTerminal:", error);
    }
  }
  
  return tokens;
}

/**
 * Detect variant from address (same logic as in b20-client.ts)
 */
function detectVariantFromAddress(address: string): "asset" | "stablecoin" {
  const cleaned = address.toLowerCase().replace("0x", "");
  if (cleaned.length < 40) return "asset";
  const variantInt = parseInt(cleaned.slice(20, 22), 16);
  return variantInt === 1 ? "stablecoin" : "asset";
}
