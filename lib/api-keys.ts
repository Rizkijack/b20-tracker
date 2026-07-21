// lib/api-keys.ts
// API key management with validation, rotation, and usage tracking

import { createHash } from "crypto";

// API key configuration
export interface APIKeyConfig {
  name: string;
  envVar: string;
  required: boolean;
  description: string;
  signUpUrl: string;
  freeTierAvailable: boolean;
  rateLimit: string;
  priority: number; // Higher = more preferred
}

// API key status
export interface APIKeyStatus {
  name: string;
  configured: boolean;
  valid: boolean;
  lastChecked: number;
  lastUsed: number | null;
  usageCount: number;
  errorCount: number;
  lastError: string | null;
}

// API key usage tracking
export interface APIKeyUsage {
  keyHash: string; // SHA256 hash of the key (for security)
  endpoint: string;
  timestamp: number;
  success: boolean;
  latency: number;
  error?: string;
}

// Supported API providers
const API_PROVIDERS: Record<string, APIKeyConfig> = {
  BIRDEYE: {
    name: "Birdeye.so",
    envVar: "BIRDEYE_API_KEY",
    required: false,
    description: "Comprehensive DeFi data aggregator with excellent Base coverage",
    signUpUrl: "https://birdeye.so/user/profile",
    freeTierAvailable: true,
    rateLimit: "60,000 credits/month (free tier)",
    priority: 10,
  },
  
  COINGECKO: {
    name: "CoinGecko",
    envVar: "COINGECKO_API_KEY",
    required: false,
    description: "Popular cryptocurrency data provider with free tier",
    signUpUrl: "https://www.coingecko.com/en/api/pricing",
    freeTierAvailable: true,
    rateLimit: "10-30 calls/minute (free), Higher with Pro key",
    priority: 8,
  },
  
  COINMARKETCAP: {
    name: "CoinMarketCap",
    envVar: "COINMARKETCAP_API_KEY",
    required: false,
    description: "Leading cryptocurrency market data provider",
    signUpUrl: "https://pro.coinmarketcap.com/signup",
    freeTierAvailable: true,
    rateLimit: "10,000 calls/month (free tier)",
    priority: 7,
  },
  
  // RPC Providers
  ALCHEMY: {
    name: "Alchemy",
    envVar: "ALCHEMY_API_KEY",
    required: false,
    description: "Premium blockchain RPC provider with excellent Base support",
    signUpUrl: "https://www.alchemy.com/",
    freeTierAvailable: true,
    rateLimit: "300M compute units/month (free tier)",
    priority: 10,
  },
  
  INFURA: {
    name: "Infura",
    envVar: "INFURA_API_KEY",
    required: false,
    description: "Reliable blockchain RPC provider",
    signUpUrl: "https://infura.io/",
    freeTierAvailable: true,
    rateLimit: "100,000 requests/day (free tier)",
    priority: 9,
  },
  
  QUICKNODE: {
    name: "QuickNode",
    envVar: "QUICKNODE_API_KEY",
    required: false,
    description: "High-performance blockchain RPC provider",
    signUpUrl: "https://www.quicknode.com/",
    freeTierAvailable: true,
    rateLimit: "Varies by plan",
    priority: 8,
  },
  
  // Redis
  UPSTASH: {
    name: "Upstash Redis",
    envVar: "UPSTASH_REDIS_REST_TOKEN",
    required: false,
    description: "Serverless Redis for caching",
    signUpUrl: "https://upstash.com/",
    freeTierAvailable: true,
    rateLimit: "10,000 commands/day (free tier)",
    priority: 5,
  },
};

// API Key Manager
class APIKeyManager {
  private keys: Map<string, string>;
  private keyStatus: Map<string, APIKeyStatus>;
  private usageHistory: APIKeyUsage[];
  private maxHistorySize: number;

  constructor() {
    this.keys = new Map();
    this.keyStatus = new Map();
    this.usageHistory = [];
    this.maxHistorySize = 1000;
    
    // Load keys from environment
    this.loadFromEnvironment();
    
    // Initialize status for all providers
    Object.values(API_PROVIDERS).forEach(provider => {
      this.keyStatus.set(provider.name, {
        name: provider.name,
        configured: this.keys.has(provider.envVar),
        valid: false, // Will be validated on first use
        lastChecked: 0,
        lastUsed: null,
        usageCount: 0,
        errorCount: 0,
        lastError: null,
      });
    });
  }

  private loadFromEnvironment(): void {
    Object.entries(API_PROVIDERS).forEach(([_, provider]) => {
      const value = process.env[provider.envVar];
      if (value && value.trim() !== "") {
        this.keys.set(provider.envVar, value.trim());
      }
    });
  }

  /**
   * Get an API key by provider name
   */
  getKey(providerName: string): string | null {
    const provider = API_PROVIDERS[providerName];
    if (!provider) return null;
    
    return this.keys.get(provider.envVar) || null;
  }

  /**
   * Get API key by environment variable name
   */
  getKeyByEnvVar(envVar: string): string | null {
    return this.keys.get(envVar) || null;
  }

  /**
   * Check if a provider has a configured key
   */
  hasKey(providerName: string): boolean {
    const provider = API_PROVIDERS[providerName];
    if (!provider) return false;
    
    return this.keys.has(provider.envVar);
  }

  /**
   * Get all configured API keys (hashed for security)
   */
  getConfiguredProviders(): string[] {
    return Object.entries(API_PROVIDERS)
      .filter(([_, provider]) => this.keys.has(provider.envVar))
      .map(([name]) => name);
  }

  /**
   * Get all API providers with their status
   */
  getAllProviderStatuses(): APIKeyStatus[] {
    return Array.from(this.keyStatus.values());
  }

  /**
   * Get status for a specific provider
   */
  getProviderStatus(providerName: string): APIKeyStatus | null {
    return this.keyStatus.get(providerName) || null;
  }

  /**
   * Validate an API key by making a test request
   */
  async validateKey(providerName: string): Promise<boolean> {
    const provider = API_PROVIDERS[providerName];
    if (!provider) return false;
    
    const key = this.getKey(providerName);
    if (!key) return false;
    
    const status = this.keyStatus.get(providerName)!;
    status.lastChecked = Date.now();

    try {
      // Different validation for different providers
      switch (providerName) {
        case "BIRDEYE":
          // Test Birdeye API
          const birdeyeRes = await fetch(
            "https://public-api.birdeye.so/defi/v3/token/market-data?address=0xB20f000000000000000000000000000000000000",
            {
              headers: { "X-API-KEY": key },
              method: "GET",
            }
          );
          status.valid = birdeyeRes.ok || birdeyeRes.status === 404; // 404 means valid key but token not found
          break;

        case "COINGECKO":
          // Test CoinGecko API
          const cgUrl = provider.freeTierAvailable 
            ? "https://api.coingecko.com/api/v3/ping"
            : "https://pro-api.coingecko.com/api/v3/ping";
          const cgRes = await fetch(cgUrl, {
            headers: key ? { "x-cg-pro-api-key": key } : {},
          });
          status.valid = cgRes.ok;
          break;

        case "COINMARKETCAP":
          // Test CoinMarketCap API
          const cmcRes = await fetch(
            "https://pro-api.coinmarketcap.com/v1/cryptocurrency/map?address=0xB20f000000000000000000000000000000000000",
            {
              headers: { "X-CMC_PRO_API_KEY": key },
            }
          );
          status.valid = cmcRes.ok || cmcRes.status === 401; // 401 might mean invalid key
          break;

        case "UPSTASH":
          // Test Upstash Redis connection
          const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
          if (upstashUrl) {
            const redisRes = await fetch(`${upstashUrl}/ping`, {
              headers: { Authorization: `Bearer ${key}` },
            });
            status.valid = redisRes.ok;
          } else {
            status.valid = false;
          }
          break;

        default:
          // For RPC providers, just check if the key exists
          status.valid = true;
      }

      if (status.valid) {
        status.errorCount = 0;
        status.lastError = null;
      }

      this.keyStatus.set(providerName, status);
      return status.valid;

    } catch (error) {
      status.valid = false;
      status.errorCount++;
      status.lastError = error instanceof Error ? error.message : "Unknown error";
      this.keyStatus.set(providerName, status);
      return false;
    }
  }

  /**
   * Validate all configured API keys
   */
  async validateAllKeys(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const providerName of this.getConfiguredProviders()) {
      results[providerName] = await this.validateKey(providerName);
    }
    
    return results;
  }

  /**
   * Record API key usage
   */
  recordUsage(
    providerName: string,
    endpoint: string,
    success: boolean,
    latency: number,
    error?: string
  ): void {
    const status = this.keyStatus.get(providerName);
    if (status) {
      status.lastUsed = Date.now();
      status.usageCount++;
      
      if (!success) {
        status.errorCount++;
        status.lastError = error || "Unknown error";
      }
      
      this.keyStatus.set(providerName, status);
    }

    // Record in history
    const key = this.getKey(providerName);
    const keyHash = key ? createHash("sha256").update(key).digest("hex") : "unknown";
    
    this.usageHistory.push({
      keyHash,
      endpoint,
      timestamp: Date.now(),
      success,
      latency,
      error,
    });

    // Trim history if too large
    if (this.usageHistory.length > this.maxHistorySize) {
      this.usageHistory = this.usageHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get API key usage statistics
   */
  getUsageStatistics(providerName?: string): {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    averageLatency: number;
    last24hUsage: number;
  } {
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
    
    let history = this.usageHistory;
    if (providerName) {
      const provider = API_PROVIDERS[providerName];
      if (provider) {
        const key = this.getKey(providerName);
        const keyHash = key ? createHash("sha256").update(key).digest("hex") : "unknown";
        history = history.filter(h => h.keyHash === keyHash);
      }
    }

    const total = history.length;
    const successful = history.filter(h => h.success).length;
    const failed = total - successful;
    const averageLatency = total > 0 
      ? history.reduce((sum, h) => sum + h.latency, 0) / total 
      : 0;
    const last24h = history.filter(h => h.timestamp > twentyFourHoursAgo).length;

    return {
      totalRequests: total,
      successfulRequests: successful,
      failedRequests: failed,
      successRate: total > 0 ? successful / total : 0,
      averageLatency,
      last24hUsage: last24h,
    };
  }

  /**
   * Get recommendations for improving API key configuration
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const configured = this.getConfiguredProviders();
    
    // Check for missing high-priority keys
    const highPriorityProviders = Object.entries(API_PROVIDERS)
      .filter(([_, provider]) => provider.priority >= 8)
      .map(([name]) => name);
    
    for (const providerName of highPriorityProviders) {
      if (!configured.includes(providerName)) {
        const provider = API_PROVIDERS[providerName];
        recommendations.push(
          `🔑 Configure ${provider.name} API key for better ${provider.description.toLowerCase()}. ` +
          `Sign up at: ${provider.signUpUrl}`
        );
      }
    }

    // Check for unvalidated keys
    for (const providerName of configured) {
      const status = this.keyStatus.get(providerName);
      if (status && !status.valid && status.lastChecked > 0) {
        recommendations.push(
          `⚠️  Validate your ${providerName} API key. It may be invalid or expired.`
        );
      }
    }

    // Check for low usage
    for (const providerName of configured) {
      const stats = this.getUsageStatistics(providerName);
      if (stats.totalRequests === 0) {
        recommendations.push(
          `📊 Your ${providerName} API key is configured but not being used. Consider enabling it in your data source configuration.`
        );
      }
    }

    // Check for high error rates
    for (const providerName of configured) {
      const stats = this.getUsageStatistics(providerName);
      if (stats.totalRequests > 10 && stats.successRate < 0.5) {
        recommendations.push(
          `❌ Your ${providerName} API key has a low success rate (${(stats.successRate * 100).toFixed(1)}%). Check your key and rate limits.`
        );
      }
    }

    if (recommendations.length === 0) {
      recommendations.push("✅ All API keys are properly configured and working well!");
    }

    return recommendations;
  }

  /**
   * Get API provider information
   */
  getProviderInfo(providerName: string): APIKeyConfig | null {
    return API_PROVIDERS[providerName] || null;
  }

  /**
   * Get all API provider information
   */
  getAllProviderInfo(): APIKeyConfig[] {
    return Object.values(API_PROVIDERS);
  }

  /**
   * Check if all required API keys are configured
   */
  areRequiredKeysConfigured(): boolean {
    return Object.values(API_PROVIDERS)
      .filter(provider => provider.required)
      .every(provider => this.keys.has(provider.envVar));
  }

  /**
   * Get a summary of API key configuration
   */
  getConfigurationSummary(): {
    totalProviders: number;
    configuredProviders: number;
    validatedProviders: number;
    missingRequired: string[];
    recommendations: string[];
  } {
    const configured = this.getConfiguredProviders();
    const validated = configured.filter(name => {
      const status = this.keyStatus.get(name);
      return status?.valid === true;
    });
    
    const missingRequired = Object.values(API_PROVIDERS)
      .filter(provider => provider.required && !configured.includes(provider.name))
      .map(provider => provider.name);

    return {
      totalProviders: Object.keys(API_PROVIDERS).length,
      configuredProviders: configured.length,
      validatedProviders: validated.length,
      missingRequired,
      recommendations: this.getRecommendations(),
    };
  }
}

// Singleton instance
export const apiKeyManager = new APIKeyManager();

// Convenience functions
export function getAPIKey(providerName: string): string | null {
  return apiKeyManager.getKey(providerName);
}

export function hasAPIKey(providerName: string): boolean {
  return apiKeyManager.hasKey(providerName);
}

export function getAPIKeyStatus(providerName: string): APIKeyStatus | null {
  return apiKeyManager.getProviderStatus(providerName);
}

export function getAPIConfigurationSummary() {
  return apiKeyManager.getConfigurationSummary();
}

export function getAPIRecommendations() {
  return apiKeyManager.getRecommendations();
}
