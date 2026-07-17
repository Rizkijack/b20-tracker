import { id } from "ethers";
import type { B20Event } from "./types";
import { truncateAddress } from "./b20-client";

// ─── Event Topic Hashes (computed at runtime) ───────────────────────────────
const TRANSFER_TOPIC = id("Transfer(address,address,uint256)");
const B20_CREATED_TOPIC = id("B20Created(uint8,address,address,bytes32)");

// ─── Decode B20Created event from log ───────────────────────────────────────
export function decodeB20CreatedEvent(log: {
  topics: string[];
  data: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
}): {
  creator: string;
  tokenAddress: string;
  variant: number;
  salt: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
} | null {
  if (log.topics[0] !== B20_CREATED_TOPIC) return null;

  try {
    // B20Created(uint8 variant, address creator, address token, bytes32 salt)
    // topics[1] = creator (indexed), topics[2] = token (indexed)
    // data: variant (uint8, padded to 32 bytes) + salt (bytes32)
    const creator = "0x" + log.topics[1].slice(log.topics[1].length - 40);
    const tokenAddress = "0x" + log.topics[2].slice(log.topics[2].length - 40);

    // Decode data: first 32 bytes = variant (uint8), next 32 bytes = salt (bytes32)
    const variantHex = log.data.slice(2 + 62, 2 + 64); // last 2 hex chars of first 32 bytes
    const variant = parseInt(variantHex, 16);
    const salt = "0x" + log.data.slice(2 + 64, 2 + 128); // next 32 bytes

    return {
      creator,
      tokenAddress,
      variant: isNaN(variant) ? 0 : variant,
      salt,
      blockNumber: log.blockNumber,
      txHash: log.txHash,
      logIndex: log.logIndex,
    };
  } catch {
    return null;
  }
}

// ─── Decode Transfer event from log ─────────────────────────────────────────
export function decodeTransferEvent(log: {
  topics: string[];
  data: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  address: string;
}): B20Event | null {
  if (log.topics[0] !== TRANSFER_TOPIC) return null;
  if (log.topics.length < 3) return null;

  try {
    // topics[1] = from (indexed), topics[2] = to (indexed)
    const from = "0x" + log.topics[1].slice(log.topics[1].length - 40);
    const to = "0x" + log.topics[2].slice(log.topics[2].length - 40);

    // data = amount (uint256, non-indexed)
    const amount = BigInt(log.data);

    // Determine event type: mint (from=0x0), burn (to=0x0), or transfer
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    let type: B20Event["type"] = "transfer";

    if (from.toLowerCase() === ZERO_ADDRESS) {
      type = "mint";
    } else if (to.toLowerCase() === ZERO_ADDRESS) {
      type = "burn";
    }

    return {
      id: `${log.txHash}-${log.logIndex}`,
      type,
      tokenAddress: log.address,
      blockNumber: log.blockNumber,
      txHash: log.txHash,
      logIndex: log.logIndex,
      timestamp: 0, // filled later by fetcher
      from,
      to,
      amount,
    };
  } catch {
    return null;
  }
}

// ─── Build event display text ──────────────────────────────────────────────
export function getEventDescription(event: B20Event): string {
  switch (event.type) {
    case "transfer":
      return `${truncateAddress(event.from ?? "")} → ${truncateAddress(event.to ?? "")}`;
    case "mint":
      return `Minted to ${truncateAddress(event.to ?? "")}`;
    case "burn":
      return `Burned from ${truncateAddress(event.from ?? "")}`;
    case "pause":
      return "Token paused";
    case "unpause":
      return "Token unpaused";
    case "role_granted":
      return `Role granted to ${truncateAddress(event.account ?? "")}`;
    case "role_revoked":
      return `Role revoked from ${truncateAddress(event.account ?? "")}`;
    case "supply_cap_updated":
      return "Supply cap updated";
    case "b20_created":
      return `New B20 token by ${truncateAddress(event.creator ?? "")}`;
    case "memo":
      return event.memo || "Memo attached";
    default:
      return "Unknown event";
  }
}

// ─── Get event type badge color ────────────────────────────────────────────
export function getEventBadgeColor(type: B20Event["type"]): string {
  switch (type) {
    case "transfer":
      return "bg-blue-500/20 text-blue-400 border border-blue-500/30";
    case "mint":
      return "bg-green-500/20 text-green-400 border border-green-500/30";
    case "burn":
      return "bg-red-500/20 text-red-400 border border-red-500/30";
    case "pause":
      return "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
    case "unpause":
      return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
    case "role_granted":
      return "bg-purple-500/20 text-purple-400 border border-purple-500/30";
    case "role_revoked":
      return "bg-orange-500/20 text-orange-400 border border-orange-500/30";
    case "supply_cap_updated":
      return "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30";
    case "b20_created":
      return "bg-pink-500/20 text-pink-400 border border-pink-500/30";
    case "memo":
      return "bg-slate-500/20 text-slate-400 border border-slate-500/30";
    case "policy_updated":
      return "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30";
    default:
      return "bg-gray-500/20 text-gray-400 border border-gray-500/30";
  }
}

// ─── Get event type icon ────────────────────────────────────────────────────
export function getEventIcon(type: B20Event["type"]): string {
  switch (type) {
    case "transfer": return "⇄";
    case "mint": return "⊕";
    case "burn": return "⊖";
    case "pause": return "⏸";
    case "unpause": return "▶";
    case "role_granted": return "🔑";
    case "role_revoked": return "🚫";
    case "supply_cap_updated": return "📊";
    case "b20_created": return "🆕";
    case "memo": return "📝";
    case "policy_updated": return "📋";
    default: return "●";
  }
}

// ─── Get event type label ───────────────────────────────────────────────────
export function getEventLabel(type: B20Event["type"]): string {
  switch (type) {
    case "transfer": return "Transfer";
    case "mint": return "Mint";
    case "burn": return "Burn";
    case "pause": return "Pause";
    case "unpause": return "Unpause";
    case "role_granted": return "Role Granted";
    case "role_revoked": return "Role Revoked";
    case "supply_cap_updated": return "Cap Updated";
    case "b20_created": return "Token Created";
    case "memo": return "Memo";
    case "policy_updated": return "Policy Updated";
    default: return "Event";
  }
}
