// app/api/thirdparty-tokens/route.ts
// GET /api/thirdparty-tokens?limit=100
// Returns B20 tokens discovered via third-party APIs (DexScreener, GeckoTerminal)

import { NextResponse } from "next/server";
import { fetchB20TokensFromThirdParty } from "@/lib/b20-factory";

export const runtime = "nodejs";
export const revalidate = 60; // Revalidate every 60 seconds

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const limit = parseInt(searchParams.get("limit") || "100");
  
  // Validate inputs
  if (isNaN(limit) || limit <= 0 || limit > 500) {
    return NextResponse.json(
      { error: "Invalid limit. Must be between 1 and 500" },
      { status: 400 }
    );
  }
  
  try {
    const tokens = await fetchB20TokensFromThirdParty(limit);
    return NextResponse.json(tokens, { status: 200 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Third-party tokens error:", error);
    return NextResponse.json(
      { error: `Failed to fetch third-party tokens: ${msg}` },
      { status: 500 }
    );
  }
}
