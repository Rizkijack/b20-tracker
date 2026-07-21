// lib/monitoring.ts
// Comprehensive monitoring system for B20 Scanner

import { performance } from "perf_hooks";
import { rpcPool } from "./rpc-config";
import { advancedCache } from "./advanced-cache";
import { apiKeyManager } from "./api-keys";

// Monitoring configuration
export interface MonitoringConfig {
  enabled: boolean;
  interval: number; // Monitoring interval in ms
  maxHistory: number; // Maximum history size
  alertThresholds: {
    rpcLatency: number; // ms
    cacheHitRate: number; // percentage
    apiSuccessRate: number; // percentage
    tokenDiscoveryTime: number; // ms
  };
}

// Default configuration
const DEFAULT_CONFIG: MonitoringConfig = {
  enabled: process.env.NODE_ENV === "production" || process.env.MONITORING_ENABLED === "true",
  interval: 60000, // 1 minute
  maxHistory: 1000,
  alertThresholds: {
    rpcLatency: 5000, // 5 seconds
    cacheHitRate: 0.7, // 70%
    apiSuccessRate: 0.8, // 80%
    tokenDiscoveryTime: 10000, // 10 seconds
  },
};

// Monitoring metrics
export interface MonitoringMetrics {
  timestamp: number;
  
  // RPC Metrics
  rpc: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatency: number;
    providers: Array<{
      url: string;
      healthy: boolean;
      latency: number;
      requests: number;
      errors: number;
    }>;
  };
  
  // Cache Metrics
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    redis: {
      connected: boolean;
      hits: number;
      misses: number;
      hitRate: number;
      latency: number;
    };
    inMemory: {
      hits: number;
      misses: number;
      hitRate: number;
      size: number;
      evictions: number;
    };
  };
  
  // API Metrics
  api: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    averageLatency: number;
    endpoints: Record<string, {
      requests: number;
      success: number;
      failures: number;
      latency: number;
    }>;
  };
  
  // Token Discovery Metrics
  tokenDiscovery: {
    totalTokens: number;
    discoveryTime: number;
    dataSources: Record<string, {
      tokensFound: number;
      discoveryTime: number;
      lastUsed: number;
    }>;
  };
  
  // System Metrics
  system: {
    memoryUsage: number;
    cpuUsage: number;
    uptime: number;
    lastRestart: number;
  };
}

// Alert types
export interface MonitoringAlert {
  id: string;
  type: "warning" | "error" | "critical";
  title: string;
  message: string;
  timestamp: number;
  severity: number; // 1-10
  resolved: boolean;
  resolutionTime: number | null;
}

// Monitoring history
export interface MonitoringHistory {
  timestamp: number;
  metrics: MonitoringMetrics;
  alerts: MonitoringAlert[];
}

// Monitor class
class Monitor {
  private config: MonitoringConfig;
  private metrics: MonitoringMetrics;
  private history: MonitoringHistory[];
  private alerts: MonitoringAlert[];
  private alertIdCounter: number;
  private startTime: number;
  private lastCollectionTime: number;
  private intervalId: NodeJS.Timeout | null;

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = this.createEmptyMetrics();
    this.history = [];
    this.alerts = [];
    this.alertIdCounter = 0;
    this.startTime = Date.now();
    this.lastCollectionTime = Date.now();
    this.intervalId = null;
  }

  private createEmptyMetrics(): MonitoringMetrics {
    return {
      timestamp: Date.now(),
      rpc: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageLatency: 0,
        providers: [],
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        redis: {
          connected: false,
          hits: 0,
          misses: 0,
          hitRate: 0,
          latency: 0,
        },
        inMemory: {
          hits: 0,
          misses: 0,
          hitRate: 0,
          size: 0,
          evictions: 0,
        },
      },
      api: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        successRate: 0,
        averageLatency: 0,
        endpoints: {},
      },
      tokenDiscovery: {
        totalTokens: 0,
        discoveryTime: 0,
        dataSources: {},
      },
      system: {
        memoryUsage: 0,
        cpuUsage: 0,
        uptime: 0,
        lastRestart: this.startTime,
      },
    };
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (!this.config.enabled) {
      console.log("⚠️  Monitoring is disabled");
      return;
    }

    if (this.intervalId) {
      this.stop();
    }

    // Collect initial metrics
    this.collectMetrics();

    // Start interval
    this.intervalId = setInterval(() => {
      this.collectMetrics();
    }, this.config.interval);

    console.log("📊 Monitoring started with interval:", this.config.interval, "ms");
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("📊 Monitoring stopped");
    }
  }

  /**
   * Collect all metrics
   */
  async collectMetrics(): Promise<void> {
    if (!this.config.enabled) return;

    const startTime = performance.now();
    const newMetrics = this.createEmptyMetrics();
    newMetrics.timestamp = Date.now();

    try {
      // Collect RPC metrics
      newMetrics.rpc = this.collectRPCMetrics();

      // Collect cache metrics
      newMetrics.cache = this.collectCacheMetrics();

      // Collect API metrics
      newMetrics.api = this.collectAPIMetrics();

      // Collect token discovery metrics
      newMetrics.tokenDiscovery = this.collectTokenDiscoveryMetrics();

      // Collect system metrics
      newMetrics.system = this.collectSystemMetrics();

      // Update metrics
      this.metrics = newMetrics;

      // Check for alerts
      this.checkForAlerts();

      // Save to history
      this.saveToHistory(newMetrics);

      // Log collection time
      const collectionTime = performance.now() - startTime;
      console.log(`📊 Metrics collected in ${collectionTime.toFixed(2)}ms`);

    } catch (error) {
      console.error("❌ Error collecting metrics:", error);
    }
  }

  private collectRPCMetrics(): MonitoringMetrics["rpc"] {
    const rpcMetrics = rpcPool.getMetrics();
    const healthStatus = rpcPool.getHealthStatus();

    const totalRequests = rpcMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const successfulRequests = rpcMetrics.reduce((sum, m) => sum + m.successfulRequests, 0);
    const failedRequests = rpcMetrics.reduce((sum, m) => sum + m.failedRequests, 0);
    
    const averageLatency = rpcMetrics.length > 0
      ? rpcMetrics.reduce((sum, m) => sum + m.averageLatency, 0) / rpcMetrics.length
      : 0;

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageLatency,
      providers: healthStatus.map(status => ({
        url: status.url,
        healthy: status.healthy,
        latency: status.metrics.averageLatency,
        requests: status.metrics.totalRequests,
        errors: status.metrics.failedRequests,
      })),
    };
  }

  private collectCacheMetrics(): MonitoringMetrics["cache"] {
    const cacheStats = advancedCache.getStats();
    const redisStats = cacheStats.redis;
    const inMemoryStats = cacheStats.inMemory;

    return {
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      hitRate: cacheStats.hitRate,
      redis: {
        connected: redisStats.connected,
        hits: redisStats.hits,
        misses: redisStats.misses,
        hitRate: redisStats.hitRate,
        latency: redisStats.averageLatency,
      },
      inMemory: {
        hits: inMemoryStats.hits,
        misses: inMemoryStats.misses,
        hitRate: inMemoryStats.hitRate,
        size: inMemoryStats.size,
        evictions: inMemoryStats.evictions,
      },
    };
  }

  private collectAPIMetrics(): MonitoringMetrics["api"] {
    const apiStats = apiKeyManager.getUsageStatistics();
    const providerStatuses = apiKeyManager.getAllProviderStatuses();

    // For now, we'll use the overall API stats
    // In a real implementation, you'd track per-endpoint metrics
    return {
      totalRequests: apiStats.totalRequests,
      successfulRequests: apiStats.successfulRequests,
      failedRequests: apiStats.failedRequests,
      successRate: apiStats.successRate,
      averageLatency: apiStats.averageLatency,
      endpoints: providerStatuses.reduce((acc, status) => {
        acc[status.name] = {
          requests: status.usageCount,
          success: status.usageCount - status.errorCount,
          failures: status.errorCount,
          latency: 0, // Would need per-provider latency tracking
        };
        return acc;
      }, {} as Record<string, { requests: number; success: number; failures: number; latency: number }>),
    };
  }

  private collectTokenDiscoveryMetrics(): MonitoringMetrics["tokenDiscovery"] {
    // This would be populated by the token discovery system
    // For now, return empty metrics
    return {
      totalTokens: 0, // Would be updated by useB20Tokens
      discoveryTime: 0,
      dataSources: {
        factory: { tokensFound: 0, discoveryTime: 0, lastUsed: 0 },
        thirdparty: { tokensFound: 0, discoveryTime: 0, lastUsed: 0 },
        blockscan: { tokensFound: 0, discoveryTime: 0, lastUsed: 0 },
      },
    };
  }

  private collectSystemMetrics(): MonitoringMetrics["system"] {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      memoryUsage: memoryUsage.heapUsed / 1024 / 1024, // MB
      cpuUsage: 0, // Would need a CPU monitoring library
      uptime: Math.floor(uptime),
      lastRestart: this.startTime,
    };
  }

  /**
   * Check for alerts based on current metrics
   */
  private checkForAlerts(): void {
    const now = Date.now();
    const thresholds = this.config.alertThresholds;

    // Check RPC latency
    if (this.metrics.rpc.averageLatency > thresholds.rpcLatency) {
      this.addAlert({
        type: "warning",
        title: "High RPC Latency",
        message: `Average RPC latency (${this.metrics.rpc.averageLatency.toFixed(0)}ms) exceeds threshold (${thresholds.rpcLatency}ms)`,
        severity: 7,
      });
    }

    // Check cache hit rate
    if (this.metrics.cache.hitRate < thresholds.cacheHitRate) {
      this.addAlert({
        type: "warning",
        title: "Low Cache Hit Rate",
        message: `Cache hit rate (${(this.metrics.cache.hitRate * 100).toFixed(1)}%) is below threshold (${thresholds.cacheHitRate * 100}%)`,
        severity: 6,
      });
    }

    // Check API success rate
    if (this.metrics.api.successRate < thresholds.apiSuccessRate) {
      this.addAlert({
        type: "warning",
        title: "Low API Success Rate",
        message: `API success rate (${(this.metrics.api.successRate * 100).toFixed(1)}%) is below threshold (${thresholds.apiSuccessRate * 100}%)`,
        severity: 8,
      });
    }

    // Check Redis connection
    if (!this.metrics.cache.redis.connected) {
      this.addAlert({
        type: "warning",
        title: "Redis Not Connected",
        message: "Redis cache is not connected. In-memory cache is being used as fallback.",
        severity: 5,
      });
    }

    // Check for failed RPC providers
    const failedProviders = this.metrics.rpc.providers.filter(p => !p.healthy);
    if (failedProviders.length > 0) {
      const providerNames = failedProviders.map(p => p.url).join(", ");
      this.addAlert({
        type: "error",
        title: "RPC Providers Failed",
        message: `The following RPC providers are not healthy: ${providerNames}`,
        severity: 9,
      });
    }

    // Check system memory
    if (this.metrics.system.memoryUsage > 512) { // 512MB
      this.addAlert({
        type: "warning",
        title: "High Memory Usage",
        message: `Memory usage (${this.metrics.system.memoryUsage.toFixed(1)}MB) is high`,
        severity: 7,
      });
    }
  }

  /**
   * Add a new alert
   */
  private addAlert(alert: Omit<MonitoringAlert, "id" | "timestamp" | "resolved" | "resolutionTime">): void {
    const existingAlert = this.alerts.find(a => 
      a.title === alert.title && !a.resolved
    );

    if (existingAlert) {
      // Update existing alert
      existingAlert.message = alert.message;
      existingAlert.severity = alert.severity;
      existingAlert.timestamp = Date.now();
    } else {
      // Create new alert
      const newAlert: MonitoringAlert = {
        id: `alert_${this.alertIdCounter++}_${Date.now()}`,
        timestamp: Date.now(),
        resolved: false,
        resolutionTime: null,
        ...alert,
      };
      this.alerts.push(newAlert);
    }

    // Log the alert
    console.log(`🚨 ALERT: [${alert.type.toUpperCase()}] ${alert.title} - ${alert.message}`);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId && !a.resolved);
    if (alert) {
      alert.resolved = true;
      alert.resolutionTime = Date.now();
      console.log(`✅ ALERT RESOLVED: ${alert.title}`);
      return true;
    }
    return false;
  }

  /**
   * Resolve all alerts
   */
  resolveAllAlerts(): number {
    let count = 0;
    for (const alert of this.alerts) {
      if (!alert.resolved) {
        alert.resolved = true;
        alert.resolutionTime = Date.now();
        count++;
      }
    }
    return count;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): MonitoringAlert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): MonitoringAlert[] {
    return [...this.alerts];
  }

  /**
   * Get resolved alerts
   */
  getResolvedAlerts(): MonitoringAlert[] {
    return this.alerts.filter(a => a.resolved);
  }

  /**
   * Save metrics to history
   */
  private saveToHistory(metrics: MonitoringMetrics): void {
    const historyEntry: MonitoringHistory = {
      timestamp: Date.now(),
      metrics,
      alerts: this.getActiveAlerts(),
    };

    this.history.push(historyEntry);

    // Trim history if too large
    if (this.history.length > this.config.maxHistory) {
      this.history = this.history.slice(-this.config.maxHistory);
    }
  }

  /**
   * Get monitoring history
   */
  getHistory(limit?: number): MonitoringHistory[] {
    if (limit) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): MonitoringMetrics {
    return { ...this.metrics };
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): {
    timestamp: number;
    uptime: number;
    alerts: {
      active: number;
      resolved: number;
      total: number;
    };
    rpc: {
      healthy: boolean;
      latency: number;
      successRate: number;
    };
    cache: {
      healthy: boolean;
      hitRate: number;
      redisConnected: boolean;
    };
    api: {
      healthy: boolean;
      successRate: number;
    };
    system: {
      healthy: boolean;
      memoryUsage: number;
    };
  } {
    const activeAlerts = this.getActiveAlerts();
    const resolvedAlerts = this.getResolvedAlerts();

    return {
      timestamp: this.metrics.timestamp,
      uptime: this.metrics.system.uptime,
      alerts: {
        active: activeAlerts.length,
        resolved: resolvedAlerts.length,
        total: this.alerts.length,
      },
      rpc: {
        healthy: this.metrics.rpc.providers.every(p => p.healthy),
        latency: this.metrics.rpc.averageLatency,
        successRate: this.metrics.rpc.totalRequests > 0 
          ? this.metrics.rpc.successfulRequests / this.metrics.rpc.totalRequests 
          : 1,
      },
      cache: {
        healthy: this.metrics.cache.hitRate >= this.config.alertThresholds.cacheHitRate,
        hitRate: this.metrics.cache.hitRate,
        redisConnected: this.metrics.cache.redis.connected,
      },
      api: {
        healthy: this.metrics.api.successRate >= this.config.alertThresholds.apiSuccessRate,
        successRate: this.metrics.api.successRate,
      },
      system: {
        healthy: this.metrics.system.memoryUsage < 512, // 512MB
        memoryUsage: this.metrics.system.memoryUsage,
      },
    };
  }

  /**
   * Get health status for API endpoint
   */
  getHealthStatus(): {
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check RPC health
    if (!this.metrics.rpc.providers.every(p => p.healthy)) {
      issues.push("Some RPC providers are not healthy");
      recommendations.push("Configure additional RPC endpoints for redundancy");
    }

    // Check cache health
    if (!this.metrics.cache.redis.connected && this.config.enabled) {
      issues.push("Redis cache is not connected");
      recommendations.push("Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN");
    }

    // Check cache hit rate
    if (this.metrics.cache.hitRate < this.config.alertThresholds.cacheHitRate) {
      issues.push("Cache hit rate is low");
      recommendations.push("Increase cache TTL or add more cacheable data");
    }

    // Check API success rate
    if (this.metrics.api.successRate < this.config.alertThresholds.apiSuccessRate) {
      issues.push("API success rate is low");
      recommendations.push("Check API keys and rate limits");
    }

    // Check for active alerts
    const activeAlerts = this.getActiveAlerts();
    if (activeAlerts.length > 0) {
      issues.push(`${activeAlerts.length} active alerts`);
      recommendations.push("Check the monitoring dashboard for details");
    }

    // Check API key configuration
    const apiSummary = apiKeyManager.getConfigurationSummary();
    if (apiSummary.missingRequired.length > 0) {
      issues.push(`Missing required API keys: ${apiSummary.missingRequired.join(", ")}`);
      recommendations.push("Configure all required API keys");
    }

    // Check RPC configuration
    const rpcConfig = rpcPool.getHealthStatus();
    if (rpcConfig.length === 0) {
      issues.push("No RPC providers configured");
      recommendations.push("Configure BASE_RPC_URL in environment variables");
    }

    return {
      healthy: issues.length === 0,
      issues,
      recommendations,
    };
  }

  /**
   * Reset monitoring
   */
  reset(): void {
    this.metrics = this.createEmptyMetrics();
    this.history = [];
    this.alerts = [];
    this.alertIdCounter = 0;
    this.lastCollectionTime = Date.now();
  }
}

// Singleton instance
export const monitor = new Monitor();

// Start monitoring on import if enabled
if (DEFAULT_CONFIG.enabled) {
  monitor.start();
}

// Export monitoring functions
export function startMonitoring(config?: Partial<MonitoringConfig>): void {
  const customMonitor = new Monitor(config);
  customMonitor.start();
  // Replace the singleton
  Object.assign(monitor, customMonitor);
}

export function stopMonitoring(): void {
  monitor.stop();
}

export function getMonitoringMetrics(): MonitoringMetrics {
  return monitor.getCurrentMetrics();
}

export function getMonitoringSummary() {
  return monitor.getMetricsSummary();
}

export function getMonitoringHealth() {
  return monitor.getHealthStatus();
}

export function getActiveAlerts(): MonitoringAlert[] {
  return monitor.getActiveAlerts();
}

export function getMonitoringHistory(limit?: number) {
  return monitor.getHistory(limit);
}
