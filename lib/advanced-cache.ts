// lib/advanced-cache.ts
// Advanced caching system with Redis, in-memory cache, and intelligent TTL management

import { createClient, RedisClientType } from "redis";
import { cacheGet as simpleCacheGet, cacheSet as simpleCacheSet, TTL } from "./server-cache";

// Cache configuration
export interface CacheConfig {
  // Redis configuration
  redisUrl?: string;
  redisToken?: string;
  redisTtlMultiplier?: number; // Multiply TTL for Redis vs in-memory
  
  // In-memory cache configuration
  inMemoryEnabled: boolean;
  inMemoryMaxSize: number;
  inMemoryTtlMultiplier?: number;
  
  // Cache strategies
  useRedis: boolean;
  useInMemory: boolean;
  
  // Performance settings
  cacheHitTracking: boolean;
  cacheMissTracking: boolean;
}

// Cache statistics
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  redisHits: number;
  redisMisses: number;
  inMemoryHits: number;
  inMemoryMisses: number;
  averageLatency: number;
  lastReset: number;
}

// Cache key patterns
export const CACHE_PATTERNS = {
  // Token data
  TOKEN_METADATA: (address: string) => `meta:${address.toLowerCase()}`,
  TOKEN_MARKET: (address: string) => `mkt:${address.toLowerCase()}`,
  TOKEN_EVENTS: (address: string, fromBlock: number, toBlock: number) => `events:${address.toLowerCase()}:${fromBlock}:${toBlock}`,
  
  // Block data
  BLOCK_TIMESTAMP: (blockNumber: number) => `blk:${blockNumber}`,
  BLOCK_LATEST: "block:latest",
  
  // Factory data
  FACTORY_TOKENS: (limit: number, fromBlock: number) => `factory:tokens:${limit}:${fromBlock}`,
  
  // Discovery data
  DISCOVERED_TOKENS: (fromBlock: number, toBlock: number) => `discover:${fromBlock}:${toBlock}`,
  
  // Market data
  MARKET_BATCH: (addresses: string[]) => `mkt:batch:${addresses.sort().join(",").toLowerCase()}`,
  
  // Health and monitoring
  HEALTH_STATUS: "health:status",
  RPC_METRICS: "rpc:metrics",
  DATA_SOURCE_STATUS: "datasource:status",
} as const;

// Default cache configuration
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  redisUrl: process.env.UPSTASH_REDIS_REST_URL,
  redisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
  redisTtlMultiplier: 2, // Redis TTL is 2x in-memory TTL
  inMemoryEnabled: true,
  inMemoryMaxSize: 10000,
  inMemoryTtlMultiplier: 0.5, // In-memory TTL is 0.5x base TTL
  useRedis: !!process.env.UPSTASH_REDIS_REST_URL,
  useInMemory: true,
  cacheHitTracking: true,
  cacheMissTracking: true,
};

// In-memory cache implementation
class InMemoryCache {
  private cache: Map<string, { value: unknown; expiresAt: number }>;
  private maxSize: number;
  private accessOrder: string[];
  private stats: {
    hits: number;
    misses: number;
    evictions: number;
  };

  constructor(maxSize: number = 10000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.accessOrder = [];
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    
    // Update access order (LRU)
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
    
    this.stats.hits++;
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttl: number): void {
    // Evict if at capacity
    while (this.cache.size >= this.maxSize && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift()!;
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
    
    const expiresAt = Date.now() + ttl;
    this.cache.set(key, { value, expiresAt });
    
    // Update access order
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  delete(key: string): boolean {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  getStats(): { hits: number; misses: number; hitRate: number; size: number; evictions: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      size: this.cache.size,
      evictions: this.stats.evictions,
    };
  }

  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }
}

// Redis cache implementation
class RedisCache {
  private client: RedisClientType | null;
  private connected: boolean;
  private connectionError: string | null;
  private stats: {
    hits: number;
    misses: number;
    errors: number;
    latency: number;
    totalRequests: number;
  };

  constructor(url?: string, token?: string) {
    this.client = null;
    this.connected = false;
    this.connectionError = null;
    this.stats = { hits: 0, misses: 0, errors: 0, latency: 0, totalRequests: 0 };
    
    if (url && token) {
      this.connect(url, token);
    }
  }

  private async connect(url: string, token: string): Promise<void> {
    try {
      // Upstash Redis REST client
      this.client = createClient({
        url,
        token,
      }) as RedisClientType;
      
      // Test connection
      await this.client.ping();
      this.connected = true;
      this.connectionError = null;
      console.log("✅ Redis cache connected successfully");
    } catch (error) {
      this.connected = false;
      this.connectionError = error instanceof Error ? error.message : "Unknown error";
      console.warn("⚠️ Redis cache connection failed:", this.connectionError);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.connected || !this.client) {
      this.stats.misses++;
      return null;
    }

    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      const value = await this.client.get(key);
      
      if (value === null) {
        this.stats.misses++;
        return null;
      }
      
      this.stats.hits++;
      this.stats.latency += Date.now() - startTime;
      
      return JSON.parse(value) as T;
    } catch (error) {
      this.stats.errors++;
      this.stats.misses++;
      console.error("Redis get error:", error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    if (!this.connected || !this.client) {
      return;
    }

    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      this.stats.errors++;
      console.error("Redis set error:", error);
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.connected || !this.client) {
      return false;
    }

    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      this.stats.errors++;
      console.error("Redis delete error:", error);
      return false;
    }
  }

  async clear(): Promise<void> {
    if (!this.connected || !this.client) {
      return;
    }

    try {
      // Note: FLUSHDB is dangerous in production, use with caution
      // For now, we'll just log a warning
      console.warn("Redis clear() called - this would clear the entire database!");
    } catch (error) {
      this.stats.errors++;
      console.error("Redis clear error:", error);
    }
  }

  getStats(): {
    connected: boolean;
    connectionError: string | null;
    hits: number;
    misses: number;
    hitRate: number;
    errors: number;
    averageLatency: number;
    totalRequests: number;
  } {
    const total = this.stats.hits + this.stats.misses;
    return {
      connected: this.connected,
      connectionError: this.connectionError,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      errors: this.stats.errors,
      averageLatency: this.stats.totalRequests > 0 ? this.stats.latency / this.stats.totalRequests : 0,
      totalRequests: this.stats.totalRequests,
    };
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConnectionError(): string | null {
    return this.connectionError;
  }
}

// Main cache manager
class AdvancedCacheManager {
  private config: CacheConfig;
  private inMemoryCache: InMemoryCache;
  private redisCache: RedisCache;
  private stats: CacheStats;
  private lastReset: number;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.inMemoryCache = new InMemoryCache(this.config.inMemoryMaxSize);
    this.redisCache = new RedisCache(this.config.redisUrl, this.config.redisToken);
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      redisHits: 0,
      redisMisses: 0,
      inMemoryHits: 0,
      inMemoryMisses: 0,
      averageLatency: 0,
      lastReset: Date.now(),
    };
    this.lastReset = Date.now();
  }

  /**
   * Get a value from cache with multi-layer lookup
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();

    // Try Redis first if enabled
    if (this.config.useRedis && this.redisCache.isConnected()) {
      const redisValue = await this.redisCache.get<T>(key);
      if (redisValue !== null) {
        this.stats.hits++;
        this.stats.redisHits++;
        this.stats.averageLatency = (
          (this.stats.averageLatency * (this.stats.hits - 1) + (Date.now() - startTime)) / this.stats.hits
        );
        return redisValue;
      }
      this.stats.redisMisses++;
    }

    // Try in-memory cache
    if (this.config.useInMemory) {
      const memoryValue = this.inMemoryCache.get<T>(key);
      if (memoryValue !== null) {
        this.stats.hits++;
        this.stats.inMemoryHits++;
        this.stats.averageLatency = (
          (this.stats.averageLatency * (this.stats.hits - 1) + (Date.now() - startTime)) / this.stats.hits
        );
        return memoryValue;
      }
      this.stats.inMemoryMisses++;
    }

    this.stats.misses++;
    this.stats.averageLatency = (
      (this.stats.averageLatency * (this.stats.hits + this.stats.misses - 1) + (Date.now() - startTime)) / (this.stats.hits + this.stats.misses)
    );
    return null;
  }

  /**
   * Set a value in cache with multi-layer storage
   */
  async set<T>(key: string, value: T, baseTtl: number): Promise<void> {
    // Calculate TTLs for each layer
    const redisTtl = this.config.useRedis ? baseTtl * (this.config.redisTtlMultiplier || 1) : 0;
    const memoryTtl = this.config.useInMemory ? baseTtl * (this.config.inMemoryTtlMultiplier || 1) : 0;

    // Store in Redis
    if (this.config.useRedis && this.redisCache.isConnected() && redisTtl > 0) {
      await this.redisCache.set(key, value, redisTtl);
    }

    // Store in memory
    if (this.config.useInMemory && memoryTtl > 0) {
      this.inMemoryCache.set(key, value, memoryTtl);
    }
  }

  /**
   * Delete a value from all cache layers
   */
  async delete(key: string): Promise<boolean> {
    let deleted = false;

    if (this.config.useRedis && this.redisCache.isConnected()) {
      deleted = await this.redisCache.delete(key) || deleted;
    }

    if (this.config.useInMemory) {
      deleted = this.inMemoryCache.delete(key) || deleted;
    }

    return deleted;
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    if (this.config.useRedis) {
      await this.redisCache.clear();
    }
    if (this.config.useInMemory) {
      this.inMemoryCache.clear();
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): CacheStats & {
    redis: ReturnType<RedisCache["getStats"]>;
    inMemory: ReturnType<InMemoryCache["getStats"]>;
    config: CacheConfig;
  } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      redis: this.redisCache.getStats(),
      inMemory: this.inMemoryCache.getStats(),
      config: this.config,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      redisHits: 0,
      redisMisses: 0,
      inMemoryHits: 0,
      inMemoryMisses: 0,
      averageLatency: 0,
      lastReset: Date.now(),
    };
    this.lastReset = Date.now();
  }

  /**
   * Check if cache is healthy
   */
  isHealthy(): boolean {
    if (this.config.useRedis && !this.redisCache.isConnected()) {
      return false;
    }
    return true;
  }

  /**
   * Get cache health status
   */
  getHealthStatus(): {
    healthy: boolean;
    redisConnected: boolean;
    inMemoryEnabled: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (this.config.useRedis && !this.redisCache.isConnected()) {
      issues.push(`Redis not connected: ${this.redisCache.getConnectionError()}`);
    }

    if (this.config.useInMemory && this.inMemoryCache.getStats().size >= this.config.inMemoryMaxSize) {
      issues.push("In-memory cache at capacity");
    }

    return {
      healthy: issues.length === 0,
      redisConnected: this.redisCache.isConnected(),
      inMemoryEnabled: this.config.useInMemory,
      issues,
    };
  }
}

// Singleton instance
export const advancedCache = new AdvancedCacheManager();

// Convenience functions for backward compatibility
export async function cacheGet<T>(key: string): Promise<T | null> {
  return advancedCache.get<T>(key);
}

export async function cacheSet<T>(key: string, value: T, ttl: number): Promise<void> {
  return advancedCache.set(key, value, ttl);
}

// Enhanced cache functions with custom TTL
export async function getWithCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = TTL.DEFAULT
): Promise<T> {
  const cached = await advancedCache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  const value = await fetchFn();
  await advancedCache.set(key, value, ttl);
  return value;
}

export async function getWithCacheSimple<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = TTL.DEFAULT
): Promise<T> {
  // Use simple cache for backward compatibility
  const cached = await simpleCacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  const value = await fetchFn();
  await simpleCacheSet(key, value, ttl);
  return value;
}

// Cache statistics endpoint helper
export function getCacheStatistics() {
  return advancedCache.getStats();
}
