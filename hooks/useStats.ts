"use client";

import { useState, useEffect, useCallback } from "react";
import type { B20Stats } from "@/lib/types";
import { formatNumber } from "@/lib/b20-client";
import { getCurrentBlockNumber } from "@/lib/b20-client";

export function useStats(tokens: {
  address: string;
  variant: string;
  totalSupply: bigint;
  isPaused: boolean;
}[]) {
  const [stats, setStats] = useState<B20Stats>({
    totalTokens: 0,
    totalAssetTokens: 0,
    totalStablecoinTokens: 0,
    totalSupply: BigInt(0),
    totalMints: 0,
    totalBurns: 0,
    totalTransfers24h: 0,
    pausedTokens: 0,
  });
  const [blockHeight, setBlockHeight] = useState<number>(0);

  const updateStats = useCallback(async () => {
    try {
      const currentBlock = await getCurrentBlockNumber();
      setBlockHeight(currentBlock);

      let totalSupply = BigInt(0);
      let totalAsset = 0;
      let totalStablecoin = 0;
      let paused = 0;

      for (const token of tokens) {
        totalSupply += token.totalSupply;
        if (token.variant === "asset") totalAsset++;
        else totalStablecoin++;
        if (token.isPaused) paused++;
      }

      setStats({
        totalTokens: tokens.length,
        totalAssetTokens: totalAsset,
        totalStablecoinTokens: totalStablecoin,
        totalSupply,
        totalMints: 0, // counted from events
        totalBurns: 0, // counted from events
        totalTransfers24h: 0, // counted from events
        pausedTokens: paused,
      });
    } catch {
      // ignore
    }
  }, [tokens]);

  useEffect(() => {
    updateStats();
    const interval = setInterval(updateStats, 15000);
    return () => clearInterval(interval);
  }, [updateStats]);

  return { stats, blockHeight };
}
