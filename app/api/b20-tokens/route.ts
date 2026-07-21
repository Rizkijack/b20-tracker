// app/api/b20-tokens/route.ts
// GET /api/b20-tokens
// Returns all B20 tokens from multiple sources with market data

import { NextResponse } from "next/server";
import { getB20TokensWithMetadata } from "@/lib/b20-factory";
import { fetchB20TokensFromThirdParty } from "@/lib/b20-factory";
import { batchFetchMarketData } from "@/lib/market-data";
import { detectVariant } from "@/lib/b20-client";
import { B20_ADDRESS_PREFIX } from "@/lib/constants";

export const runtime = "nodejs";
export const revalidate = 30; // Revalidate every 30 seconds

interface TokenResponse {
  address: string;
  name: string;
  symbol: string;
  variant: "asset" | "stablecoin";
  decimals: number;
  totalSupply: string;
  creator: string;
  createdAt: number;
  txHash: string;
  marketData?: any;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "500");
  const includeMarket = searchParams.get("market") !== "false";
  
  // Validate inputs
  if (isNaN(limit) || limit <= 0 || limit > 1000) {
    return NextResponse.json(
      { error: "Invalid limit. Must be between 1 and 1000" },
      { status: 400 }
    );
  }
  
  try {
    // 1. Try to get tokens from factory
    let tokens = await getB20TokensWithMetadata(limit);
    
    // 2. If factory returns few tokens, supplement with third-party
    if (tokens.length < limit / 2) {
      const thirdPartyTokens = await fetchB20TokensFromThirdParty(limit - tokens.length);
      
      for (const tpToken of thirdPartyTokens) {
        if (!tokens.some(t => t.address.toLowerCase() === tpToken.address.toLowerCase())) {
          tokens.push({
            address: tpToken.address,
            name: tpToken.name,
            symbol: tpToken.symbol,
            variant: tpToken.variant,
            decimals: 18, // Default
            totalSupply: BigInt(0),
            supplyCap: BigInt(0),
            creator: "",
            createdAt: 0,
            txHash: "",
            isPaused: false,
          });
        }
      }
    }
    
    // 3. If we still don't have enough, try block scanning as last resort
    if (tokens.length < Math.min(limit, 100)) {
      // Import here to avoid circular dependency
      const { discoverB20Tokens, getCurrentBlockNumber, getBlockTimestamp } = await import("@/lib/b20-client");
      const { MAX_TOKEN_DISCOVERY_BATCH } = await import("@/lib/constants");
      
      try {
        const latestBlock = await getCurrentBlockNumber();
        const fromBlock = Math.max(0, latestBlock - MAX_TOKEN_DISCOVERY_BATCH);
        const discovered = await discoverB20Tokens(fromBlock, latestBlock);
        
        for (const discToken of discovered) {
          if (!tokens.some(t => t.address.toLowerCase() === discToken.address.toLowerCase())) {
            const variant = detectVariant(discToken.address);
            const timestamp = await getBlockTimestamp(discToken.blockNumber);
            
            tokens.push({
              address: discToken.address,
              name: "Unknown",
              symbol: "???",
              variant,
              decimals: 18,
              totalSupply: BigInt(0),
              supplyCap: BigInt(0),
              creator: "",
              createdAt: timestamp,
              txHash: discToken.txHash,
              isPaused: false,
            });
          }
        }
      } catch (error) {
        console.error("Block scan fallback failed:", error);
      }
    }
    
    // 4. Fetch market data if requested
    let tokensWithMarket = tokens;
    if (includeMarket && tokens.length > 0) {
      try {
        const addresses = tokens.map(t => t.address);
        const marketDataMap = await batchFetchMarketData(addresses, {}, 10);
        
        tokensWithMarket = tokens.map(token => {
          const marketData = marketDataMap.get(token.address.toLowerCase());
          return marketData ? { ...token, marketData } : token;
        });
      } catch (error) {
        console.error("Market data fetch failed:", error);
      }
    }
    
    // 5. Format response
    const response: TokenResponse[] = tokensWithMarket.map(token => ({
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      variant: token.variant,
      decimals: token.decimals,
      totalSupply: token.totalSupply.toString(),
      creator: token.creator,
      createdAt: token.createdAt,
      txHash: token.txHash,
      marketData: token.marketData,
    }));
    
    return NextResponse.json({
      success: true,
      count: response.length,
      data: response,
      timestamp: Date.now(),
    }, { status: 200 });
    
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("B20 tokens API error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: `Failed to fetch B20 tokens: ${msg}` 
      },
      { status: 500 }
    );
  }
}
