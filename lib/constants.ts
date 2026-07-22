// B20 Protocol Constants for Base Mainnet

// ─── Precompile Addresses (same on all Base networks) ───────────────────────
export const B20_FACTORY_ADDRESS = "0xB20f000000000000000000000000000000000000" as const;
export const POLICY_REGISTRY_ADDRESS = "0x8453000000000000000000000000000000000002" as const;

// ─── B20 Address Prefix ──────────────────────────────────────────────────────
// NOTE: `0xB20f` is the B20_FACTORY precompile address; actual B20 *token*
// addresses are deterministically derived and start with `0xb200` (ASSET)
// or `0xb201` (STABLECOIN). The variant byte sits at hex position [20:22]
// (byte 10). This was previously `0xB20f`, which is the factory — that is why
// token discovery always returned empty (no token ever matches the factory
// address as a prefix). Verified live against the factory precompile on
// Base mainnet: getB20Address(0, sender, salt) -> 0xb200…,
// getB20Address(1, sender, salt) -> 0xb201…
export const B20_ADDRESS_PREFIX = "0xb200";

// ─── Base Mainnet RPC (server-side) ──────────────────────────────────────
// Server code MUST read BASE_RPC_URL (never exposed to the browser).
// NEXT_PUBLIC_BASE_RPC_URL is only a client-side fallback for the public endpoint.
// We also support a comma-separated list of RPC URLs for rotation on rate limits.
const SERVER_RPC = process.env.BASE_RPC_URL;
const CLIENT_RPC =
  process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org";

const RAW_RPC_LIST = (SERVER_RPC || CLIENT_RPC)
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);

export const BASE_RPC_URLS: string[] = RAW_RPC_LIST.length
  ? RAW_RPC_LIST
  : ["https://mainnet.base.org"];

// Primary RPC used by the singleton provider (server context).
export const BASE_MAINNET_RPC = BASE_RPC_URLS[0];

// ─── B20 Variant enum ───────────────────────────────────────────────────────
export const B20Variant = {
  ASSET: 0,
  STABLECOIN: 1,
} as const;
export type B20VariantType = (typeof B20Variant)[keyof typeof B20Variant];

export const B20VariantLabels: Record<number, string> = {
  [B20Variant.ASSET]: "Asset",
  [B20Variant.STABLECOIN]: "Stablecoin",
};

// ─── B20 Roles ──────────────────────────────────────────────────────────────
export const B20Roles = {
  DEFAULT_ADMIN_ROLE: "0x0000000000000000000000000000000000000000000000000000000000000000",
  MINT_ROLE: "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8c984a6e7297", // keccak256("MINT_ROLE")
  BURN_ROLE: "0xf5b2a969e6ab4d0e9d5f38a0e264a3ecbc5c516eb0af3a78af1c4bc01ebf0d86", // keccak256("BURN_ROLE")
  BURN_BLOCKED_ROLE: "0x0bc07ba2b6dc04afe8740f4aaffbca1c780847d24c2cc8cc2f4e7ff3b3ec51d5", // keccak256("BURN_BLOCKED_ROLE")
  PAUSE_ROLE: "0x65d7a28e3265b37a6474929f336521b332c1681b9a548c9e97e28c0d8c2c0b5e", // keccak256("PAUSE_ROLE")
  UNPAUSE_ROLE: "0x24103fbc83306b4db55ef4e88bebd1b4cfb5e3ae58e9c6cd6e038dd3ade12b7a", // keccak256("UNPAUSE_ROLE")
  METADATA_ROLE: "0x3565bf23ae2a09271c29fe080a18779eb7c67c44b3e562057a2e90588e2dbbfc", // keccak256("METADATA_ROLE")
  OPERATOR_ROLE: "0x56d80ece27a0e1f4ca0a06a38167ef0a31749d9243c4b591bc5e08a54ad80b48", // keccak256("OPERATOR_ROLE")
} as const;

export const B20RoleLabels: Record<string, string> = {
  [B20Roles.DEFAULT_ADMIN_ROLE]: "Admin",
  [B20Roles.MINT_ROLE]: "Minter",
  [B20Roles.BURN_ROLE]: "Burner",
  [B20Roles.BURN_BLOCKED_ROLE]: "Burn Blocked",
  [B20Roles.PAUSE_ROLE]: "Pauser",
  [B20Roles.UNPAUSE_ROLE]: "Unpauser",
  [B20Roles.METADATA_ROLE]: "Metadata",
  [B20Roles.OPERATOR_ROLE]: "Operator",
};

// ─── Event Topic Hashes ────────────────────────────────────────────────────
// Computed at runtime via ethers `id()` from the canonical B20 event signatures
// (per base-std IB20.sol and Coinbase CDP B20 events reference). We never hard-code
// the keccak256 — that is how the placeholder values drifted from reality.
import { id } from "ethers";

export const EVENT_TOPICS = {
  // B20 factory creation event (emitted by the B20_FACTORY precompile when a
  // new B20 token is created). Canonical signature per base-std IB20Factory.sol:
  //   event B20Created(address indexed token, uint8 indexed variant, string name,
  //                    string symbol, uint8 decimals, bytes variantEventParams);
  B20_CREATED: id("B20Created(address,uint8,string,string,uint8,bytes)"),

  // Standard ERC-20 / B20 transfer (mint = from(0x0), burn = to(0x0))
  TRANSFER: id("Transfer(address,address,uint256)"),
  APPROVAL: id("Approval(address,address,uint256)"),

  // Memo (emitted immediately after any memo'd op)
  MEMO: id("Memo(address,bytes32)"),

  // Access control (OpenZeppelin AccessControl layout)
  ROLE_GRANTED: id("RoleGranted(bytes32,address,address)"),
  ROLE_REVOKED: id("RoleRevoked(bytes32,address,address)"),
  ROLE_ADMIN_CHANGED: id("RoleAdminChanged(bytes32,bytes32,bytes32)"),
  LAST_ADMIN_RENOUNCED: id("LastAdminRenounced(address)"),

  // Pause (PausableFeature is encoded as uint8 in the current interface)
  PAUSED: id("Paused(address,uint8[])"),
  UNPAUSED: id("Unpaused(address,uint8[])"),

  // Supply cap
  SUPPLY_CAP_UPDATED: id("SupplyCapUpdated(address,uint256,uint256)"),

  // Policy
  POLICY_UPDATED: id("PolicyUpdated(bytes32,uint64,uint64)"),
  CONTRACT_URI_UPDATED: id("ContractURIUpdated()"),

  // Metadata
  NAME_UPDATED: id("NameUpdated(address,string)"),
  SYMBOL_UPDATED: id("SymbolUpdated(address,string)"),
} as const;

// Reverse lookup: topic -> canonical signature, used by the event decoder.
export const EVENT_SIGNATURES: Record<string, string> = {
  [EVENT_TOPICS.B20_CREATED]: "B20Created(address,uint8,string,string,uint8,bytes)",
  [EVENT_TOPICS.TRANSFER]: "Transfer(address,address,uint256)",
  [EVENT_TOPICS.MEMO]: "Memo(address,bytes32)",
  [EVENT_TOPICS.ROLE_GRANTED]: "RoleGranted(bytes32,address,address)",
  [EVENT_TOPICS.ROLE_REVOKED]: "RoleRevoked(bytes32,address,address)",
  [EVENT_TOPICS.ROLE_ADMIN_CHANGED]: "RoleAdminChanged(bytes32,bytes32,bytes32)",
  [EVENT_TOPICS.LAST_ADMIN_RENOUNCED]: "LastAdminRenounced(address)",
  [EVENT_TOPICS.PAUSED]: "Paused(address,uint8[])",
  [EVENT_TOPICS.UNPAUSED]: "Unpaused(address,uint8[])",
  [EVENT_TOPICS.SUPPLY_CAP_UPDATED]: "SupplyCapUpdated(address,uint256,uint256)",
  [EVENT_TOPICS.POLICY_UPDATED]: "PolicyUpdated(bytes32,uint64,uint64)",
  [EVENT_TOPICS.CONTRACT_URI_UPDATED]: "ContractURIUpdated()",
  [EVENT_TOPICS.NAME_UPDATED]: "NameUpdated(address,string)",
  [EVENT_TOPICS.SYMBOL_UPDATED]: "SymbolUpdated(address,string)",
};

// Topic list for multi-event log queries.
export const ALL_B20_EVENT_TOPICS = Object.values(EVENT_TOPICS);

// ─── Minimal ABIs ────────────────────────────────────────────────────────────
export const B20_TOKEN_ABI = [
  // ERC-20 core
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function currency() view returns (string)", // B20 Stablecoin-specific
] as const;

export const B20_FACTORY_ABI = [
  "function createB20(uint8 variant, bytes32 salt, bytes params, bytes[] initCalls) payable returns (address)",
  "function getB20Address(uint8 variant, address sender, bytes32 salt) view returns (address)",
  "function isB20(address addr) view returns (bool)",
] as const;

// ─── Polling Configuration ─────────────────────────────────────────────────
export const POLLING_INTERVAL = 4000; // 4 seconds
export const STATS_REFRESH_INTERVAL = 30000; // 30 seconds
export const MAX_EVENTS_PER_POLL = 100;
export const MAX_TOKEN_DISCOVERY_BATCH = 10000;

// ─── UI Constants ───────────────────────────────────────────────────────────
export const EXPLORER_URL = "https://basescan.org";
export const MAX_LIVE_EVENTS = 50;
export const TOKENS_PER_PAGE = 12;
