import { NextRequest, NextResponse } from "next/server";
import { Contract } from "ethers";
import { getProvider } from "@/lib/b20-server";
import { B20_TOKEN_ABI } from "@/lib/constants";
import { cacheGet, cacheSet, cacheKey, TTL } from "@/lib/rpc-cache";

export const dynamic = "force-dynamic";
export const preferredRegion = ["iad1"]; // US East (closest to Base RPC)

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "Missing 'address' query param" }, { status: 400 });
  }

  const cache = cacheKey("metadata", address.toLowerCase());
  const cached = cacheGet<{
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
    currency?: string;
  }>(cache);
  if (cached) return NextResponse.json(cached);

  try {
    const provider = getProvider();
    const contract = new Contract(address, B20_TOKEN_ABI, provider);

    const [name, symbol, decimals, totalSupply] = await Promise.all([
      contract.name.staticCall().catch(() => "Unknown"),
      contract.symbol.staticCall().catch(() => "???"),
      contract.decimals.staticCall().catch(() => BigInt(18)),
      contract.totalSupply.staticCall().catch(() => BigInt(0)),
    ]);

    let currency: string | undefined;
    try {
      currency = await contract.currency.staticCall();
    } catch {
      // not a stablecoin
    }

    const result = {
      name: String(name || "Unknown"),
      symbol: String(symbol || "???"),
      decimals: Number(decimals) || 18,
      totalSupply: totalSupply.toString(),
      currency,
    };

    cacheSet(cache, result, TTL.TOKEN_METADATA);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Metadata fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch token metadata" },
      { status: 500 },
    );
  }
}
