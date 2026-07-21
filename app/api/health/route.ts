// app/api/health/route.ts
// GET /api/health
// Health check endpoint for monitoring data source availability

import { NextResponse } from "next/server";
import { getDataSourceStatus, getHealthCheckEndpoints } from "@/lib/data-sources";

export const runtime = "nodejs";
export const revalidate = 60; // Revalidate every 60 seconds

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: number;
  dataSources: Record<string, { available: boolean; reason?: string }>;
  endpoints: Record<string, { status: "ok" | "error"; latency?: number }>;
  recommendations: string[];
}

export async function GET(request: Request) {
  const startTime = Date.now();
  const status: HealthStatus = {
    status: "healthy",
    timestamp: startTime,
    dataSources: getDataSourceStatus(),
    endpoints: {},
    recommendations: [],
  };
  
  try {
    // Check each endpoint
    const endpoints = getHealthCheckEndpoints();
    
    for (const [name, endpoint] of Object.entries(endpoints)) {
      try {
        const endpointStart = Date.now();
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}${endpoint}`, {
          cache: "no-store",
          // Don't actually make external calls in health check
          // Just mark as ok if the endpoint exists
        });
        
        status.endpoints[name] = {
          status: "ok",
          latency: Date.now() - endpointStart,
        };
      } catch (error) {
        status.endpoints[name] = {
          status: "error",
        };
        status.status = "degraded";
      }
    }
    
    // Generate recommendations
    const unavailableSources = Object.entries(status.dataSources)
      .filter(([_, { available }]) => !available)
      .map(([id]) => id);
    
    if (unavailableSources.length > 0) {
      status.recommendations.push(
        `Configure API keys for: ${unavailableSources.join(", ")} to improve data quality`
      );
    }
    
    // Check if we have at least one working data source
    const availableSources = Object.values(status.dataSources)
      .filter(source => source.available).length;
    
    if (availableSources === 0) {
      status.status = "unhealthy";
      status.recommendations.push(
        "No data sources are available. Please configure at least one API key."
      );
    }
    
    return NextResponse.json(status, { status: 200 });
    
  } catch (error) {
    return NextResponse.json({
      status: "unhealthy",
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : "Unknown error",
      dataSources: {},
      endpoints: {},
      recommendations: ["Check server logs for details"],
    }, { status: 500 });
  }
}
