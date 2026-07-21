// lib/security.ts
// Security utilities and middleware for B20 Scanner

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

// Security configuration
export interface SecurityConfig {
  // HTTPS settings
  enforceHttps: boolean;
  httpsRedirectCode: number;
  
  // CORS settings
  corsEnabled: boolean;
  corsOrigins: string[];
  corsMethods: string[];
  corsHeaders: string[];
  corsCredentials: boolean;
  corsMaxAge: number;
  
  // Rate limiting
  rateLimitingEnabled: boolean;
  rateLimitWindow: number; // in ms
  rateLimitMaxRequests: number;
  
  // Request validation
  maxRequestSize: number; // in bytes
  allowedContentTypes: string[];
  
  // Security headers
  securityHeaders: Record<string, string>;
  
  // API key protection
  apiKeyProtectionEnabled: boolean;
  apiKeyHeader: string;
  
  // Input sanitization
  sanitizeInputs: boolean;
  
  // Logging
  logSecurityEvents: boolean;
}

// Default security configuration
const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  // HTTPS settings
  enforceHttps: process.env.NODE_ENV === "production",
  httpsRedirectCode: 308, // Permanent redirect
  
  // CORS settings
  corsEnabled: true,
  corsOrigins: [
    "http://localhost:3000",
    "https://b20-scanner.vercel.app",
    "https://*.vercel.app",
    "https://*.base.org",
  ],
  corsMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
  corsHeaders: [
    "Content-Type",
    "Authorization",
    "X-API-Key",
    "X-Request-ID",
    "Accept",
    "Origin",
  ],
  corsCredentials: true,
  corsMaxAge: 86400, // 24 hours
  
  // Rate limiting
  rateLimitingEnabled: process.env.NODE_ENV === "production",
  rateLimitWindow: 60000, // 1 minute
  rateLimitMaxRequests: 100, // requests per window
  
  // Request validation
  maxRequestSize: 1024 * 1024 * 10, // 10MB
  allowedContentTypes: ["application/json", "text/plain", "application/x-www-form-urlencoded"],
  
  // Security headers
  securityHeaders: {
    // Prevent clickjacking
    "X-Frame-Options": "DENY",
    
    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",
    
    // Enable XSS protection
    "X-XSS-Protection": "1; mode=block",
    
    // Referrer policy
    "Referrer-Policy": "strict-origin-when-cross-origin",
    
    // Permissions policy
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    
    // Content Security Policy
    "Content-Security-Policy": 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self'; " +
      "connect-src 'self' https://*.base.org https://api.dexscreener.com https://api.geckoterminal.com; " +
      "frame-src 'none'; " +
      "object-src 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self';",
    
    // Strict Transport Security (HSTS)
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    
    // Cross-Origin Embedder Policy
    "Cross-Origin-Embedder-Policy": "require-corp",
    
    // Cross-Origin Opener Policy
    "Cross-Origin-Opener-Policy": "same-origin",
    
    // Cross-Origin Resource Policy
    "Cross-Origin-Resource-Policy": "same-origin",
  },
  
  // API key protection
  apiKeyProtectionEnabled: process.env.NODE_ENV === "production",
  apiKeyHeader: "X-API-Key",
  
  // Input sanitization
  sanitizeInputs: true,
  
  // Logging
  logSecurityEvents: process.env.NODE_ENV !== "development",
};

// Rate limiting storage
export interface RateLimitEntry {
  ip: string;
  requests: number;
  windowStart: number;
}

// Security middleware
class SecurityMiddleware {
  private config: SecurityConfig;
  private rateLimitStore: Map<string, RateLimitEntry>;
  private blockedIPs: Set<string>;
  private apiKeys: Set<string>;

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
    this.rateLimitStore = new Map();
    this.blockedIPs = new Set();
    this.apiKeys = new Set();
    
    // Load API keys from environment
    this.loadAPIKeys();
  }

  private loadAPIKeys(): void {
    // Load API keys from environment variables
    const apiKeys = [
      process.env.API_KEY,
      process.env.B20_SCANNER_API_KEY,
      process.env.NEXT_PUBLIC_API_KEY,
    ].filter(key => key && key.trim() !== "");
    
    apiKeys.forEach(key => this.apiKeys.add(key!));
  }

  /**
   * HTTPS enforcement middleware
   */
  enforceHttps(request: NextRequest): NextResponse | null {
    if (!this.config.enforceHttps) return null;
    
    const proto = request.headers.get("x-forwarded-proto");
    const host = request.headers.get("host");
    
    // Check if the request is already HTTPS
    if (proto === "https") return null;
    
    // Check if we're on localhost (don't redirect in development)
    if (host?.includes("localhost") || host?.includes("127.0.0.1")) return null;
    
    // Redirect to HTTPS
    const url = new URL(request.url);
    url.protocol = "https:";
    
    if (this.config.logSecurityEvents) {
      console.log(`🔒 Redirecting HTTP to HTTPS: ${request.url}`);
    }
    
    return NextResponse.redirect(url.toString(), this.config.httpsRedirectCode);
  }

  /**
   * CORS middleware
   */
  handleCors(request: NextRequest, response: NextResponse): NextResponse {
    if (!this.config.corsEnabled) return response;
    
    const origin = request.headers.get("origin");
    
    // Check if origin is allowed
    const isAllowedOrigin = origin && (
      this.config.corsOrigins.includes("*") ||
      this.config.corsOrigins.includes(origin) ||
      this.config.corsOrigins.some(allowed => 
        allowed.endsWith("*.vercel.app") && origin.endsWith(".vercel.app")
      )
    );
    
    // Set CORS headers
    const headers = new Headers(response.headers);
    
    if (isAllowedOrigin) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Vary", "Origin");
    } else {
      headers.set("Access-Control-Allow-Origin", this.config.corsOrigins[0]);
    }
    
    headers.set("Access-Control-Allow-Methods", this.config.corsMethods.join(", "));
    headers.set("Access-Control-Allow-Headers", this.config.corsHeaders.join(", "));
    headers.set("Access-Control-Max-Age", this.config.corsMaxAge.toString());
    
    if (this.config.corsCredentials) {
      headers.set("Access-Control-Allow-Credentials", "true");
    }
    
    // Handle preflight requests
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers });
    }
    
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  /**
   * Rate limiting middleware
   */
  checkRateLimit(request: NextRequest): { allowed: boolean; remaining: number; resetAt: number } {
    if (!this.config.rateLimitingEnabled) {
      return { allowed: true, remaining: this.config.rateLimitMaxRequests, resetAt: Date.now() + this.config.rateLimitWindow };
    }
    
    const ip = this.getClientIP(request);
    
    // Check if IP is blocked
    if (this.blockedIPs.has(ip)) {
      return { allowed: false, remaining: 0, resetAt: Date.now() + 3600000 }; // 1 hour
    }
    
    const now = Date.now();
    let entry = this.rateLimitStore.get(ip);
    
    // Create new entry if doesn't exist or window has expired
    if (!entry || entry.windowStart + this.config.rateLimitWindow < now) {
      entry = {
        ip,
        requests: 0,
        windowStart: now,
      };
      this.rateLimitStore.set(ip, entry);
    }
    
    // Check if limit exceeded
    if (entry.requests >= this.config.rateLimitMaxRequests) {
      if (this.config.logSecurityEvents) {
        console.warn(`🚫 Rate limit exceeded for IP: ${ip}`);
      }
      return { allowed: false, remaining: 0, resetAt: entry.windowStart + this.config.rateLimitWindow };
    }
    
    // Increment request count
    entry.requests++;
    this.rateLimitStore.set(ip, entry);
    
    const remaining = this.config.rateLimitMaxRequests - entry.requests;
    const resetAt = entry.windowStart + this.config.rateLimitWindow;
    
    return { allowed: true, remaining, resetAt };
  }

  /**
   * API key validation middleware
   */
  validateApiKey(request: NextRequest): boolean {
    if (!this.config.apiKeyProtectionEnabled) return true;
    
    const apiKey = request.headers.get(this.config.apiKeyHeader);
    
    if (!apiKey) {
      if (this.config.logSecurityEvents) {
        console.warn(`🔑 Missing API key in request: ${request.url}`);
      }
      return false;
    }
    
    const isValid = this.apiKeys.has(apiKey);
    
    if (!isValid && this.config.logSecurityEvents) {
      console.warn(`🔑 Invalid API key: ${apiKey.substring(0, 8)}...`);
    }
    
    return isValid;
  }

  /**
   * Request size validation
   */
  validateRequestSize(request: NextRequest): boolean {
    const contentLength = request.headers.get("content-length");
    
    if (contentLength) {
      const size = parseInt(contentLength);
      if (size > this.config.maxRequestSize) {
        if (this.config.logSecurityEvents) {
          console.warn(`📦 Request too large: ${size} bytes (max: ${this.config.maxRequestSize})`);
        }
        return false;
      }
    }
    
    return true;
  }

  /**
   * Content type validation
   */
  validateContentType(request: NextRequest): boolean {
    const contentType = request.headers.get("content-type");
    
    if (!contentType) return true; // No content type specified is OK
    
    return this.config.allowedContentTypes.some(allowed => 
      contentType.includes(allowed)
    );
  }

  /**
   * Input sanitization
   */
  sanitizeInput(input: string): string {
    if (!this.config.sanitizeInputs) return input;
    
    // Basic XSS prevention
    return input
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/\//g, "&#x2F;");
  }

  /**
   * Sanitize object keys and values
   */
  sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    if (!this.config.sanitizeInputs) return obj;
    
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = this.sanitizeInput(key);
      
      if (typeof value === "string") {
        sanitized[sanitizedKey] = this.sanitizeInput(value);
      } else if (typeof value === "object" && value !== null) {
        sanitized[sanitizedKey] = this.sanitizeObject(value as Record<string, unknown>);
      } else {
        sanitized[sanitizedKey] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Add security headers to response
   */
  addSecurityHeaders(response: NextResponse): NextResponse {
    const headers = new Headers(response.headers);
    
    // Add all security headers
    for (const [header, value] of Object.entries(this.config.securityHeaders)) {
      headers.set(header, value);
    }
    
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: NextRequest): string {
    // Check for forwarded headers (common in production environments)
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    
    if (forwardedFor) {
      // x-forwarded-for can contain multiple IPs, take the first one
      return forwardedFor.split(",")[0].trim();
    }
    
    if (realIp) {
      return realIp;
    }
    
    // Fallback to connection IP (may not be available in all environments)
    return request.ip || "unknown";
  }

  /**
   * Block an IP address
   */
  blockIP(ip: string, duration: number = 3600000): void {
    this.blockedIPs.add(ip);
    
    // Auto-unblock after duration
    setTimeout(() => {
      this.blockedIPs.delete(ip);
    }, duration);
    
    if (this.config.logSecurityEvents) {
      console.log(`🚫 Blocked IP: ${ip} for ${duration}ms`);
    }
  }

  /**
   * Unblock an IP address
   */
  unblockIP(ip: string): boolean {
    return this.blockedIPs.delete(ip);
  }

  /**
   * Add an API key
   */
  addApiKey(key: string): void {
    this.apiKeys.add(key);
  }

  /**
   * Remove an API key
   */
  removeApiKey(key: string): boolean {
    return this.apiKeys.delete(key);
  }

  /**
   * Generate a secure hash for sensitive data
   */
  hashSensitiveData(data: string, salt: string = ""): string {
    return createHash("sha256")
      .update(data + salt)
      .digest("hex");
  }

  /**
   * Generate a secure random token
   */
  generateSecureToken(length: number = 32): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let token = "";
    
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      token += chars[randomIndex];
    }
    
    return token;
  }

  /**
   * Create a security middleware handler
   */
  createMiddleware() {
    return async (request: NextRequest) => {
      // 1. Enforce HTTPS
      const httpsRedirect = this.enforceHttps(request);
      if (httpsRedirect) {
        return httpsRedirect;
      }
      
      // 2. Check rate limiting
      const rateLimit = this.checkRateLimit(request);
      if (!rateLimit.allowed) {
        return new NextResponse(JSON.stringify({
          error: "Too many requests",
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      // 3. Validate API key if required
      if (request.method !== "OPTIONS" && !this.validateApiKey(request)) {
        return new NextResponse(JSON.stringify({
          error: "Unauthorized - Invalid or missing API key",
        }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      // 4. Validate request size
      if (!this.validateRequestSize(request)) {
        return new NextResponse(JSON.stringify({
          error: "Request too large",
        }), {
          status: 413,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      // 5. Validate content type
      if (!this.validateContentType(request)) {
        return new NextResponse(JSON.stringify({
          error: "Unsupported content type",
        }), {
          status: 415,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      // Continue with the request
      return null;
    };
  }

  /**
   * Get security configuration
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * Get rate limit statistics
   */
  getRateLimitStats(): {
    totalIPs: number;
    blockedIPs: number;
    rateLimitedIPs: number;
  } {
    const now = Date.now();
    const rateLimitedIPs = Array.from(this.rateLimitStore.values())
      .filter(entry => entry.requests >= this.config.rateLimitMaxRequests);
    
    return {
      totalIPs: this.rateLimitStore.size,
      blockedIPs: this.blockedIPs.size,
      rateLimitedIPs: rateLimitedIPs.length,
    };
  }

  /**
   * Reset rate limit for an IP
   */
  resetRateLimit(ip: string): void {
    this.rateLimitStore.delete(ip);
  }

  /**
   * Clear all rate limits
   */
  clearRateLimits(): void {
    this.rateLimitStore.clear();
  }
}

// Singleton instance
export const security = new SecurityMiddleware();

// Export middleware functions
export function createSecurityMiddleware(config?: Partial<SecurityConfig>) {
  return new SecurityMiddleware(config);
}

export function enforceHttpsMiddleware(request: NextRequest): NextResponse | null {
  return security.enforceHttps(request);
}

export function handleCorsMiddleware(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  return security.handleCors(request, response);
}

export function checkRateLimitMiddleware(request: NextRequest) {
  return security.checkRateLimit(request);
}

export function validateApiKeyMiddleware(request: NextRequest): boolean {
  return security.validateApiKey(request);
}

export function addSecurityHeadersMiddleware(response: NextResponse): NextResponse {
  return security.addSecurityHeaders(response);
}

export function getSecurityConfig() {
  return security.getConfig();
}
