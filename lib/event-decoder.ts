import { getAddress } from "ethers";
import type { B20Event, B20EventType } from "./types";
import { truncateAddress } from "./b20-client";
import { EVENT_TOPICS } from "./constants";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function indexedAddress(topic: string): string {
  return "0x" + topic.slice(topic.length - 40);
}

// ─── Decode any B20 event from a raw log ────────────────────────────────────
export function decodeB20Event(log: {
  topics: string[];
  data: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  address: string;
}): B20Event | null {
  const topic = log.topics[0];
  if (!topic) return null;

  const base = {
    id: `${log.txHash}-${log.logIndex}`,
    tokenAddress: log.address,
    blockNumber: log.blockNumber,
    txHash: log.txHash,
    logIndex: log.logIndex,
    timestamp: 0, // filled later by fetcher
  };

  try {
    switch (topic) {
      case EVENT_TOPICS.TRANSFER: {
        if (log.topics.length < 3) return null;
        const from = indexedAddress(log.topics[1]);
        const to = indexedAddress(log.topics[2]);
        const amount = BigInt(log.data);
        let type: B20EventType = "transfer";
        if (from.toLowerCase() === ZERO_ADDRESS) type = "mint";
        else if (to.toLowerCase() === ZERO_ADDRESS) type = "burn";
        return { ...base, type, from, to, amount };
      }

      case EVENT_TOPICS.MEMO: {
        if (log.topics.length < 2) return null;
        const caller = indexedAddress(log.topics[1]);
        const memo = log.topics[2] ?? "0x" + "0".repeat(64);
        return { ...base, type: "memo", from: caller, memo };
      }

      case EVENT_TOPICS.ROLE_GRANTED: {
        if (log.topics.length < 3) return null;
        const role = log.topics[1];
        const account = getAddress(indexedAddress(log.topics[2]));
        return { ...base, type: "role_granted", role, account };
      }

      case EVENT_TOPICS.ROLE_REVOKED: {
        if (log.topics.length < 3) return null;
        const role = log.topics[1];
        const account = getAddress(indexedAddress(log.topics[2]));
        return { ...base, type: "role_revoked", role, account };
      }

      case EVENT_TOPICS.PAUSED:
        return { ...base, type: "pause" };

      case EVENT_TOPICS.UNPAUSED:
        return { ...base, type: "unpause" };

      case EVENT_TOPICS.SUPPLY_CAP_UPDATED: {
        // data: (address oldUpdater, uint256 oldCap, uint256 newCap) — all non-indexed
        const words = stripDataWords(log.data);
        if (words.length < 3) return null;
        const oldCap = BigInt(words[1]);
        const newCap = BigInt(words[2]);
        return { ...base, type: "supply_cap_updated", oldCap, newCap };
      }

      case EVENT_TOPICS.POLICY_UPDATED: {
        if (log.topics.length < 2) return null;
        const scope = log.topics[1];
        return { ...base, type: "policy_updated", role: scope };
      }

      case EVENT_TOPICS.NAME_UPDATED:
      case EVENT_TOPICS.SYMBOL_UPDATED: {
        // data: (address updater, string value) — decoded best-effort
        const value = decodeShortString(log.data);
        const type: B20EventType =
          topic === EVENT_TOPICS.NAME_UPDATED ? "name_updated" : "symbol_updated";
        return { ...base, type, memo: value };
      }

      default:
        return null;
    }
  } catch {
    return null;
  }
}

function stripDataWords(data: string): string[] {
  const hex = data.replace(/^0x/, "");
  const words: string[] = [];
  for (let i = 0; i + 64 <= hex.length; i += 64) {
    words.push("0x" + hex.slice(i, i + 64));
  }
  return words;
}

function decodeShortString(data: string): string {
  try {
    const hex = data.replace(/^0x/, "");
    // Last word holds the string length; prior words hold the UTF-8 bytes.
    if (hex.length < 64) return "";
    const len = parseInt(hex.slice(hex.length - 64), 16);
    const bytes = hex.slice(0, hex.length - 64);
    const clean = bytes.slice(0, len * 2);
    return Buffer.from(clean, "hex").toString("utf8");
  } catch {
    return "";
  }
}

// ─── Backwards-compatible Transfer decoder (used by live transfer feed) ─────
export function decodeTransferEvent(log: {
  topics: string[];
  data: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  address: string;
}): B20Event | null {
  if (log.topics[0] !== EVENT_TOPICS.TRANSFER) return null;
  return decodeB20Event(log);
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
    case "name_updated":
      return `Name → ${event.memo || "?"}`;
    case "symbol_updated":
      return `Symbol → ${event.memo || "?"}`;
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
    case "name_updated":
      return "bg-teal-500/20 text-teal-400 border border-teal-500/30";
    case "symbol_updated":
      return "bg-teal-500/20 text-teal-400 border border-teal-500/30";
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
    case "name_updated": return "🏷";
    case "symbol_updated": return "🏷";
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
    case "name_updated": return "Name Updated";
    case "symbol_updated": return "Symbol Updated";
    case "policy_updated": return "Policy Updated";
    default: return "Event";
  }
}
