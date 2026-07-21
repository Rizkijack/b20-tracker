// app/api/factory-tokens/route.ts
// GET /api/factory-tokens?limit=100&fromBlock=0
// Returns B20 tokens discovered via the factory contract

import { NextResponse } from "next/server";
import { getB20TokensFromFactory, getB20TokensWithMetadata } from "@/lib/b20-factory";

export const runtime = "nodejs";
export const revalidate = 30; // Revalidate every 30 seconds

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const limit = parseInt(searchParams.get("limit") || "500");
  const fromBlock = parseInt(searchParams.get("fromBlock") || "0");
  const withMetadata = searchParams.get("metadata") === "true";
  
  // Validate inputs
  if (isNaN(limit) || limit <= 0 || limit > 10000) {
    return NextResponse.json(
      { error: "Invalid limit. Must be between 1 and 10000" },
      { status: 400 }
    );
  }
  
  if (isNaN(fromBlock) || fromBlock < 0) {
    return NextResponse.json(
      { error: "Invalid fromBlock. Must be a positive number" },
      { status: 400 }
    );
  }
  
  try {
    if (withMetadata) {
      const tokens = await getB20TokensWithMetadata(limit);
      return NextResponse.json(tokens, { status: 200 });
    } else {
      const tokens = await getB20TokensFromFactory(limit, fromBlock);
      return NextResponse.json(tokens, { status: 200 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Factory tokens error:", error);
    return NextResponse.json(
      { error: `Failed to fetch factory tokens: ${msg}` },
      { status: 500 }
    );
  }
}
