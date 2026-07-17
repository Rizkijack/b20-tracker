import { id } from "ethers";
import type { B20Event, B20EventType } from "./types";
import { truncateAddress } from "./b20-client";

// ─── Event Topic Hashes (computed at runtime) ───────────────────────────────
export const TOPICS = {
  TRANSFER: id("Transfer(address,address,uint256)"),
  PAUSED: id("Paused(address)"),
  UNPAUSED: id("Unpaused(address)"),
  ROLE_GRANTED: id("RoleGranted(bytes32,address,address)"),
  ROLE_REVOKED: id("RoleRevoked(bytes32,address,address)"),
  SUPPLY_CAP_UPDATED: id("SupplyCapUpdated(uint256,uint256)"),
  POLICY_UPDATED: id("PolicyUpdated(address,bool)"),
  MEMO: id("Memo(uint256,string)"),
  B20_CREATED: id("B20Created(uint8,address,address,bytes32)"),
} as const;

// ─── Generic decode: detect event type from topic[0] ────────────────────────
export function decodeAnyEvent(log: {
  topics: string[];
  data: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  address?: string;
}): B20Event | null {
  const topic0 = log.topics[0];
  if (!topic0) return null;

  try {
    if (topic0 === TOPICS.TRANSFER) {
      return decodeTransferEvent(log as Parameters<typeof decodeTransferEvent>[0]);
    }
    if (topic0 === TOPICS.PAUSED) return decodePauseEvent(log);
    if (topic0 === TOPICS.UNPAUSED) return decodeUnpauseEvent(log);
    if (topic0 === TOPICS.ROLE_GRANTED) return decodeRoleEvent(log, "role_granted");
    if (topic0 === TOPICS.ROLE_REVOKED) return decodeRoleEvent(log, "role_revoked");
    if (topic0 === TOPICS.SUPPLY_CAP_UPDATED) return decodeSupplyCapEvent(log);
    if (topic0 === TOPICS.POLICY_UPDATED) return decodePolicyEvent(log);
    if (topic0 === TOPICS.MEMO) return decodeMemoEvent(log);
    if (topic0 === TOPICS.B20_CREATED) return decodeB20CreatedAsEvent(log);
  } catch {
    return null;
  }
  return null;
}

// ─── Transfer / Mint / Burn decoder ─────────────────────────────────────────
export function decodeTransferEvent(log: {
  topics: string[];
  data: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  address: string;
}): B20Event | null {
  if (log.topics[0] !== TOPICS.TRANSFER) return null;
  if (log.topics.length < 3) return null;

  try {
    const from = "0x" + log.topics[1].slice(log.topics[1].length - 40);
    const to = "0x" + log.topics[2].slice(log.topics[2].length - 40);
    const amount = BigInt(log.data || "0x0");

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    let type: B20EventType = "transfer";
    if (from.toLowerCase() === ZERO_ADDRESS) type = "mint";
    else if (to.toLowerCase() === ZERO_ADDRESS) type = "burn";

    return {
      id: `${log.txHash}-${log.logIndex}`,
      type,
      tokenAddress: log.address,
      blockNumber: log.blockNumber,
      txHash: log.txHash,
      logIndex: log.logIndex,
      timestamp: 0,
      from,
      to,
      amount,
    };
  } catch {
    return null;
  }
}

// ─── Paused decoder ─────────────────────────────────────────────────────────
// event Paused(address account)
export function decodePauseEvent(log: {
  topics: string[];
  data: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
}): B20Event | null {
  if (log.topics[0] !== TOPICS.PAUSED) return null;
  try {
    const account = log.topics[1]
      ? "0x" + log.topics[1].slice(log.topics[1].length - 40)
      : "0x" + log.data.slice(log.data.length - 40);
    return {
      id: `${log.txHash}-${log.logIndex}`,
      type: "pause",
      tokenAddress: "",
      blockNumber: log.blockNumber,
      txHash: log.txHash,
      logIndex: log.logIndex,
      timestamp: 0,
      account,
    };
  } catch {
    return null;
  }
}

// ─── Unpaused decoder ───────────────────────────────────────────────────────
// event Unpaused(address account)
export function decodeUnpauseEvent(log: {
  topics: string[];
  data: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
}): B20Event | null {
  if (log.topics[0] !== TOPICS.UNPAUSED) return null;
  try {
    const account = log.topics[1]
      ? "0x" + log.topics[1].slice(log.topics[1].length - 40)
      : "0x" + log.data.slice(log.data.length - 40);
    return {
      id: `${log.txHash}-${log.logIndex}`,
      type: "unpause",
      tokenAddress: "",
      blockNumber: log.blockNumber,
      txHash: log.txHash,
      logIndex: log.logIndex,
      timestamp: 0,
      account,
    };
  } catch {
    return null;
  }
}

// ─── RoleGranted / RoleRevoked decoder ──────────────────────────────────────
// event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)
// event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)
export function decodeRoleEvent(
  log: {
    topics: string[];
    data: string;
    blockNumber: number;
    txHash: string;
    logIndex: number;
  },
  type: "role_granted" | "role_revoked"
): B20Event | null {
  const targetTopic = type === "role_granted" ? TOPICS.ROLE_GRANTED : TOPICS.ROLE_REVOKED;
  if (log.topics[0] !== targetTopic) return null;
  if (log.topics.length < 4) return null;

  try {
    // topics[1] = role (bytes32, indexed)
    const role = log.topics[1];
    // topics[2] = account (address, indexed)
    const account = "0x" + log.topics[2].slice(log.topics[2].length - 40);
    // topics[3] = sender (address, indexed)
    const sender = "0x" + log.topics[3].slice(log.topics[3].length - 40);

    return {
      id: `${log.txHash}-${log.logIndex}`,
      type,
      tokenAddress: "",
      blockNumber: log.blockNumber,
      txHash: log.txHash,
      logIndex: log.logIndex,
      timestamp: 0,
      role,
      account,
    };
  } catch {
    return null;
  }
}

// ─── SupplyCapUpdated decoder ───────────────────────────────────────────────
// event SupplyCapUpdated(uint256 oldCap, uint256 newCap)
export function decodeSupplyCapEvent(log: {
  topics: string[];
  data: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
}): B20Event | null {
  if (log.topics[0] !== TOPICS.SUPPLY_CAP_UPDATED) return null;

  try {
    // Both params are non-indexed, encoded in data
    // oldCap = bytes 0-31, newCap = bytes 32-63
    const oldCap = BigInt(log.data ? "0x" + log.data.slice(2, 66) : "0x0");
    const newCap = BigInt(log.data ? "0x" + log.data.slice(66, 130) : "0x0");

    return {
      id: `${log.txHash}-${log.logIndex}`,
      type: "supply_cap_updated",
      tokenAddress: "",
      blockNumber: log.blockNumber,
      txHash: log.txHash,
      logIndex: log.logIndex,
      timestamp: 0,
      oldCap,
      newCap,
    };
  } catch {
    return null;
  }
}

// ─── PolicyUpdated decoder ──────────────────────────────────────────────────
// event PolicyUpdated(address indexed policy, bool indexed enabled)
export function decodePolicyEvent(log: {
  topics: string[];
  data: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
}): B20Event | null {
  if (log.topics[0] !== TOPICS.POLICY_UPDATED) return null;
  if (log.topics.length < 3) return null;

  try {
    // topics[1] = policy (address, indexed)
    const policy = "0x" + log.topics[1].slice(log.topics[1].length - 40);
    // topics[2] = enabled (bool, indexed)
    // bool is padded to 32 bytes, last byte is the value
    const enabledHex = log.topics[2].slice(-2);
    const enabled = parseInt(enabledHex, 16) === 1;

    return {
      id: `${log.txHash}-${log.logIndex}`,
      type: "policy_updated",
      tokenAddress: "",
      blockNumber: log.blockNumber,
      txHash: log.txHash,
      logIndex: log.logIndex,
      timestamp: 0,
      memo: `${enabled ? "Enabled" : "Disabled"} policy: ${policy}`,
      from: policy,
    };
  } catch {
    return null;
  }
}

// ─── Memo decoder ──────────────────────────────────────────────────────────
// event Memo(uint256 indexed id, string memo)
export function decodeMemoEvent(log: {
  topics: string[];
  data: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
}): B20Event | null {
  if (log.topics[0] !== TOPICS.MEMO) return null;

  try {
    // topics[1] = id (uint256, indexed)
    const memoId = BigInt(log.topics[1] || "0x0").toString();

    // Decode string from data: offset + length + content
    // First 32 bytes = offset to string data (always 32 for tightly packed)
    // Next 32 bytes = string length
    // Rest = string content
    let memoText = "";
    try {
      const offset = parseInt(log.data.slice(2, 66), 16);
      const stringDataStart = 2 + offset * 2; // offset in bytes → hex chars
      const length = parseInt(log.data.slice(stringDataStart, stringDataStart + 64), 16);
      const content = log.data.slice(stringDataStart + 64, stringDataStart + 64 + length * 2);
      // Browser-compatible hex-to-string (no Buffer dependency)
      memoText = "";
      for (let i = 0; i < content.length; i += 2) {
        const code = parseInt(content.substring(i, i + 2), 16);
        if (code >= 0x20 && code <= 0x7e) {
          memoText += String.fromCharCode(code);
        }
      }
    } catch {
      memoText = "";
    }

    return {
      id: `${log.txHash}-${log.logIndex}`,
      type: "memo",
      tokenAddress: "",
      blockNumber: log.blockNumber,
      txHash: log.txHash,
      logIndex: log.logIndex,
      timestamp: 0,
      memo: `#${memoId} ${memoText}`.trim(),
    };
  } catch {
    return null;
  }
}

// ─── B20Created → B20Event adapter ─────────────────────────────────────────
export function decodeB20CreatedAsEvent(log: {
  topics: string[];
  data: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
}): B20Event | null {
  if (log.topics[0] !== TOPICS.B20_CREATED) return null;
  try {
    const creator = "0x" + log.topics[1].slice(log.topics[1].length - 40);
    const tokenAddress = "0x" + log.topics[2].slice(log.topics[2].length - 40);
    const variantHex = log.data.slice(2 + 62, 2 + 64);
    const variant = parseInt(variantHex, 16);

    return {
      id: `${log.txHash}-${log.logIndex}`,
      type: "b20_created",
      tokenAddress,
      blockNumber: log.blockNumber,
      txHash: log.txHash,
      logIndex: log.logIndex,
      timestamp: 0,
      creator,
      variant: isNaN(variant) ? 0 : variant,
    };
  } catch {
    return null;
  }
}

// ─── B20Created raw decoder (used by sidebar widget) ────────────────────────
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
  if (log.topics[0] !== TOPICS.B20_CREATED) return null;
  try {
    const creator = "0x" + log.topics[1].slice(log.topics[1].length - 40);
    const tokenAddress = "0x" + log.topics[2].slice(log.topics[2].length - 40);
    const variantHex = log.data.slice(2 + 62, 2 + 64);
    const variant = parseInt(variantHex, 16);
    const salt = "0x" + log.data.slice(2 + 64, 2 + 128);

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

// ─── Event display helpers ──────────────────────────────────────────────────

export function getEventDescription(event: B20Event): string {
  switch (event.type) {
    case "transfer":
      return `${truncateAddress(event.from ?? "")} → ${truncateAddress(event.to ?? "")}`;
    case "mint":
      return `Minted to ${truncateAddress(event.to ?? "")}`;
    case "burn":
      return `Burned from ${truncateAddress(event.from ?? "")}`;
    case "pause":
      return `Paused by ${truncateAddress(event.account ?? "")}`;
    case "unpause":
      return `Unpaused by ${truncateAddress(event.account ?? "")}`;
    case "role_granted":
      return `Role granted to ${truncateAddress(event.account ?? "")}`;
    case "role_revoked":
      return `Role revoked from ${truncateAddress(event.account ?? "")}`;
    case "supply_cap_updated":
      return "Supply cap updated";
    case "policy_updated":
      return "Policy updated";
    case "b20_created":
      return `New B20 token by ${truncateAddress(event.creator ?? "")}`;
    case "memo":
      return event.memo || "Memo attached";
    default:
      return "Unknown event";
  }
}

export function getEventBadgeColor(type: B20EventType): string {
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

export function getEventIcon(type: B20EventType): string {
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

export function getEventLabel(type: B20EventType): string {
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
