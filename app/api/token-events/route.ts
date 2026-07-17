import { NextRequest, NextResponse } from "next/server";
import { id } from "ethers";
import { getProvider } from "@/lib/b20-server";
import { cacheGet, cacheSet, cacheKey, TTL } from "@/lib/rpc-cache";

export const dynamic = "force-dynamic";
export const preferredRegion = ["iad1"];

// All B20 event topic hashes for this specific token
const TRANSFER_TOPIC = id("Transfer(address,address,uint256)");
const PAUSED_TOPIC = id("Paused(address)");
const UNPAUSED_TOPIC = id("Unpaused(address)");
const ROLE_GRANTED_TOPIC = id("RoleGranted(bytes32,address,address)");
const ROLE_REVOKED_TOPIC = id("RoleRevoked(bytes32,address,address)");
const SUPPLY_CAP_TOPIC = id("SupplyCapUpdated(uint256,uint256)");
const POLICY_UPDATED_TOPIC = id("PolicyUpdated(address,bool)");
const MEMO_TOPIC = id("Memo(uint256,string)");

const B20_EVENT_TOPICS = [
  TRANSFER_TOPIC,
  PAUSED_TOPIC,
  UNPAUSED_TOPIC,
  ROLE_GRANTED_TOPIC,
  ROLE_REVOKED_TOPIC,
  SUPPLY_CAP_TOPIC,
  POLICY_UPDATED_TOPIC,
  MEMO_TOPIC,
];

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  const fromBlock = parseInt(request.nextUrl.searchParams.get("fromBlock") || "");
  const toBlock = parseInt(request.nextUrl.searchParams.get("toBlock") || "");

  if (!address || isNaN(fromBlock) || isNaN(toBlock)) {
    return NextResponse.json({ error: "Missing or invalid params" }, { status: 400 });
  }

  const cache = cacheKey("token-events", address.toLowerCase(), fromBlock, toBlock);
  const cached = cacheGet<{ topics: string[]; data: string; blockNumber: number; txHash: string; logIndex: number }[]>(cache);
  if (cached) return NextResponse.json(cached);

  try {
    const provider = getProvider();

    const logs = await provider.getLogs({
      fromBlock,
      toBlock,
      address,
      topics: [B20_EVENT_TOPICS], // OR-match on any B20 event topic
    });

    const result = logs.map((log) => ({
      topics: [...log.topics],
      data: log.data,
      blockNumber: Number(log.blockNumber),
      txHash: log.transactionHash ?? "",
      logIndex: Number(log.index),
    }));

    cacheSet(cache, result, TTL.TOKEN_EVENTS);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json([]);
  }
}
