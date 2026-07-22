// lib/rpc-config.ts
// Advanced RPC configuration with load balancing, failover, and performance monitoring

import { JsonRpcProvider } from "ethers";
import { BASE_RPC_URLS, BASE_MAINNET_RPC } from "./constants";

// Extended RPC configuration with weights and priorities
export interface RPCConfig {
  url: string;
  chainId: number;
  priority: number; // Higher = more preferred
  weight: number; // For load balancing
  timeout: number; // Request timeout in ms
  maxRetries: number;
  isFallback: boolean; // Use only if primary fails
  label: string; // For logging and monitoring
}

// Default RPC configurations
const DEFAULT_RPCS: RPCConfig[] = [
  {
    url: "https://mainnet.base.org",
    chainId: 8453,
    priority: 1,
    weight: 100,
    timeout: 10000,
    maxRetries: 3,
    isFallback: false,
    label: "Base Public RPC",
  },
];

// User-configured RPCs from environment
function getUserRPCs(): RPCConfig[] {
  const urls = BASE_RPC_URLS.filter(url => 
    url !== "https://mainnet.base.org" && 
    !url.includes("mainnet.base.org")
  );
  
  return urls.map((url, index) => ({
    url,
    chainId: 8453,
    priority: 2 + index, // User RPCs have higher priority
    weight: 100,
    timeout: 10000,
    maxRetries: 3,
    isFallback: false,
    label: `User RPC ${index + 1}`,
  }));
}

// Recommended professional RPC providers
const RECOMMENDED_RPCS: RPCConfig[] = [
  {
    url: "https://base-mainnet.public.blastapi.io",
    chainId: 8453,
    priority: 10,
    weight: 200,
    timeout: 8000,
    maxRetries: 5,
    isFallback: false,
    label: "BlastAPI",
  },
  {
    url: "https://base-mainnet.core.chainstack.com",
    chainId: 8453,
    priority: 9,
    weight: 180,
    timeout: 8000,
    maxRetries: 5,
    isFallback: false,
    label: "Chainstack",
  },
  {
    url: "https://base-mainnet.rpc.ankr.com",
    chainId: 8453,
    priority: 8,
    weight: 150,
    timeout: 10000,
    maxRetries: 3,
    isFallback: false,
    label: "Ankr",
  },
  {
    url: "https://base.drpc.org",
    chainId: 8453,
    priority: 7,
    weight: 120,
    timeout: 10000,
    maxRetries: 3,
    isFallback: false,
    label: "DRPC",
  },
];

// Fallback RPCs (used only if all primary RPCs fail)
const FALLBACK_RPCS: RPCConfig[] = [
  {
    url: "https://base-mainnet.g.alchemy.com/v2/demo",
    chainId: 8453,
    priority: 0,
    weight: 50,
    timeout: 15000,
    maxRetries: 2,
    isFallback: true,
    label: "Alchemy Demo",
  },
];

// RPC Performance Metrics
export interface RPCMetrics {
  url: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  lastSuccess: number | null;
  lastFailure: number | null;
  consecutiveFailures: number;
}

// Singleton RPC Pool with load balancing
class RPCPool {
  private configs: RPCConfig[];
  private providers: Map<string, JsonRpcProvider>;
  private metrics: Map<string, RPCMetrics>;
  private currentIndex: number;
  private failedProviders: Set<string>;

  constructor() {
    this.providers = new Map();
    this.metrics = new Map();
    this.currentIndex = 0;
    this.failedProviders = new Set();
    
    // Build configuration from multiple sources
    this.configs = this.buildConfiguration();
    
    // Initialize metrics
    this.configs.forEach(config => {
      this.metrics.set(config.url, {
        url: config.url,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageLatency: 0,
        lastSuccess: null,
        lastFailure: null,
        consecutiveFailures: 0,
      });
    });
  }

  private buildConfiguration(): RPCConfig[] {
    // Start with user-configured RPCs (highest priority)
    const userRPCs = getUserRPCs();
    
    // Add recommended RPCs if user hasn't configured many
    if (userRPCs.length < 2) {
      return [...userRPCs, ...RECOMMENDED_RPCS, ...DEFAULT_RPCS, ...FALLBACK_RPCS];
    }
    
    // User has configured enough RPCs
    return [...userRPCs, ...DEFAULT_RPCS, ...FALLBACK_RPCS];
  }

  /**
   * Get the next available provider using round-robin load balancing
   */
  getNextProvider(): { provider: JsonRpcProvider; config: RPCConfig } {
    const startIndex = this.currentIndex;
    let selectedConfig: RPCConfig | null = null;
    
    // Try to find a working provider
    for (let i = 0; i < this.configs.length; i++) {
      const index = (startIndex + i) % this.configs.length;
      const config = this.configs[index];
      
      // Skip failed providers temporarily
      if (this.failedProviders.has(config.url)) {
        continue;
      }
      
      // Get or create provider
      if (!this.providers.has(config.url)) {
        this.providers.set(config.url, new JsonRpcProvider(config.url, config.chainId));
      }
      
      const provider = this.providers.get(config.url)!;
      selectedConfig = config;
      this.currentIndex = (index + 1) % this.configs.length;
      break;
    }
    
    // If all providers have failed, try the first one anyway (might have recovered)
    if (!selectedConfig && this.configs.length > 0) {
      const config = this.configs[0];
      if (!this.providers.has(config.url)) {
        this.providers.set(config.url, new JsonRpcProvider(config.url, config.chainId));
      }
      selectedConfig = config;
      this.currentIndex = 1;
      this.failedProviders.clear(); // Reset failed providers
    }
    
    if (!selectedConfig) {
      throw new Error("No RPC providers available");
    }
    
    return {
      provider: this.providers.get(selectedConfig.url)!,
      config: selectedConfig,
    };
  }

  /**
   * Execute a request with automatic retry and failover
   */
  async executeWithRetry<T>(
    operation: (provider: JsonRpcProvider) => Promise<T>,
    options?: { maxAttempts?: number; timeout?: number }
  ): Promise<T> {
    const { maxAttempts = 5, timeout = 30000 } = options || {};
    const startTime = Date.now();
    let lastError: unknown;
    const attemptedUrls = new Set<string>();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`RPC request timed out after ${timeout}ms`);
      }

      const { provider, config } = this.getNextProvider();
      
      // Skip if we've already tried this URL
      if (attemptedUrls.has(config.url)) {
        continue;
      }
      attemptedUrls.add(config.url);

      const metrics = this.metrics.get(config.url)!;
      metrics.totalRequests++;

      try {
        const result = await operation(provider);
        
        // Update success metrics
        metrics.successfulRequests++;
        metrics.consecutiveFailures = 0;
        metrics.lastSuccess = Date.now();
        
        // Remove from failed providers if it was there
        this.failedProviders.delete(config.url);
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Update failure metrics
        metrics.failedRequests++;
        metrics.consecutiveFailures++;
        metrics.lastFailure = Date.now();
        
        // Mark provider as failed if too many consecutive failures
        if (metrics.consecutiveFailures >= config.maxRetries) {
          this.failedProviders.add(config.url);
        }
        
        // Log the error
        console.warn(`RPC ${config.label} (${config.url}) failed:`, error);
        
        // If this was the last attempt, throw
        if (attempt === maxAttempts - 1) {
          throw lastError;
        }
        
        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Get all RPC metrics for monitoring
   */
  getMetrics(): RPCMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get RPC health status
   */
  getHealthStatus(): { url: string; healthy: boolean; metrics: RPCMetrics }[] {
    return this.configs.map(config => {
      const metrics = this.metrics.get(config.url)!;
      const healthy = metrics.consecutiveFailures < config.maxRetries;
      return { url: config.url, healthy, metrics };
    });
  }

  /**
   * Reset a failed provider
   */
  resetProvider(url: string): void {
    this.failedProviders.delete(url);
    const metrics = this.metrics.get(url);
    if (metrics) {
      metrics.consecutiveFailures = 0;
    }
  }

  /**
   * Reset all failed providers
   */
  resetAllProviders(): void {
    this.failedProviders.clear();
    this.metrics.forEach(metrics => {
      metrics.consecutiveFailures = 0;
    });
  }

  /**
   * Get the best performing provider
   */
  getBestProvider(): { provider: JsonRpcProvider; config: RPCConfig } | null {
    let bestConfig: RPCConfig | null = null;
    let bestScore = -Infinity;
    
    for (const config of this.configs) {
      if (this.failedProviders.has(config.url)) continue;
      
      const metrics = this.metrics.get(config.url)!;
      
      // Calculate score based on success rate and latency
      const successRate = metrics.totalRequests > 0 
        ? metrics.successfulRequests / metrics.totalRequests 
        : 0.5;
      
      const score = (
        successRate * 100 +
        config.priority * 10 +
        config.weight * 0.1
      );
      
      if (score > bestScore) {
        bestScore = score;
        bestConfig = config;
      }
    }
    
    if (!bestConfig) return null;
    
    if (!this.providers.has(bestConfig.url)) {
      this.providers.set(bestConfig.url, new JsonRpcProvider(bestConfig.url, bestConfig.chainId));
    }
    
    return {
      provider: this.providers.get(bestConfig.url)!,
      config: bestConfig,
    };
  }
}

// Singleton instance
export const rpcPool = new RPCPool();

// Convenience function for simple RPC calls
export async function withRPCRetry<T>(
  operation: (provider: JsonRpcProvider) => Promise<T>,
  options?: { maxAttempts?: number; timeout?: number }
): Promise<T> {
  return rpcPool.executeWithRetry(operation, options);
}

// Get a provider for direct use (use sparingly)
export function getRPCProvider(): JsonRpcProvider {
  const { provider } = rpcPool.getNextProvider();
  return provider;
}

// Get RPC configuration for monitoring
export function getRPCConfiguration(): Array<{ url: string; healthy: boolean } & RPCMetrics> {
  return [...rpcPool.getHealthStatus().map(({ url, healthy, metrics }) => ({
    healthy,
    ...metrics,
    url,
  }))];
}
