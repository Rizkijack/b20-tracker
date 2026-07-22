// middleware.ts
// Next.js middleware for security, CORS, rate limiting, and HTTPS enforcement

import { NextRequest, NextResponse } from "next/server";
import {
  enforceHttpsMiddleware,
  handleCorsMiddleware,
  checkRateLimitMiddleware,
  validateApiKeyMiddleware,
  addSecurityHeadersMiddleware,
  getSecurityConfig,
} from "./lib/security";

// Paths that should be excluded from certain middleware
const EXCLUDED_PATHS = [
  "/_next",
  "/favicon.ico",
  "/api/health", // Health check should be accessible without API key
  "/api/b20-tokens", // Public endpoint
  "/api/factory-tokens", // Public endpoint
  "/api/thirdparty-tokens", // Public endpoint
];

// Paths that require API key
const API_KEY_REQUIRED_PATHS: string[] = [
  // Add paths that require API key protection here
  // "/api/private/*"
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const securityConfig = getSecurityConfig();

  // 1. HTTPS Enforcement
  if (securityConfig.enforceHttps) {
    const httpsRedirect = enforceHttpsMiddleware(request);
    if (httpsRedirect) {
      return httpsRedirect;
    }
  }

  // 2. Rate Limiting
  const rateLimit = checkRateLimitMiddleware(request);
  if (!rateLimit.allowed) {
    return new NextResponse(JSON.stringify({
      error: "Too many requests",
      retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
    }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. API Key Validation (for protected endpoints)
  const requiresApiKey = API_KEY_REQUIRED_PATHS.some(path => 
    pathname.startsWith(path) || pathname === path
  );
  
  if (requiresApiKey && !validateApiKeyMiddleware(request)) {
    return new NextResponse(JSON.stringify({
      error: "Unauthorized - Invalid or missing API key",
    }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 4. Continue with the request
  const response = NextResponse.next();

  // 5. Add Security Headers
  const responseWithHeaders = addSecurityHeadersMiddleware(response);

  // 6. Handle CORS
  const finalResponse = handleCorsMiddleware(request, responseWithHeaders);

  return finalResponse;
}

// Apply middleware to all paths
export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico|api/health).*)",
  ],
};
