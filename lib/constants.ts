// B20 Protocol Constants for Base Mainnet

// ─── Precompile Addresses (same on all Base networks) ───────────────────────
export const B20_FACTORY_ADDRESS = "0xB20f000000000000000000000000000000000000" as const;
export const POLICY_REGISTRY_ADDRESS = "0x8453000000000000000000000000000000000002" as const;

// ─── B20 Address Prefix ──────────────────────────────────────────────────────
// All B20 token addresses are deterministically derived and share this prefix
export const B20_ADDRESS_PREFIX = "0xB20f";

// ─── Base Mainnet RPC ──────────────────────────────────────────────────────
export const BASE_MAINNET_RPC = process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org";

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

// ─── B20 Roles (keccak256 hashes of role names) ──────────────────────────────
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

// ─── Event Topic Hashes (keccak256 of event signatures) ─────────────────────
// Computed using ethers.id() — indexed params omitted from signature
export const EVENT_TOPICS = {
  // Standard ERC-20 Transfer — also used by B20
  // Transfer(address indexed from, address indexed to, uint256 value)
  // From=0x0 → mint, To=0x0 → burn (no separate Mint/Burn events)
  TRANSFER: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",

  // OpenZeppelin Pausable
  // Paused(address account)
  PAUSED: "0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258",

  // Unpaused(address account)
  UNPAUSED: "0x5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa",

  // OpenZeppelin AccessControl
  // RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)
  ROLE_GRANTED: "0x2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d",

  // RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)
  ROLE_REVOKED: "0xf6391f5c32d9c69d2a47ea670b442974b53935d1edc7fd64eb21e047a839171b",

  // B20-specific events
  // SupplyCapUpdated(uint256 oldCap, uint256 newCap)
  SUPPLY_CAP_UPDATED: "0xb4d96b3a6638191d0f6aefa0fdc4d99af3592f4c97480e31feeb977723c63b53",

  // PolicyUpdated(address indexed policy, bool indexed enabled)
  POLICY_UPDATED: "0x24ac5fff0e5892def17518933250c7d272c0298563d12393522b0b653e928ee9",

  // Memo(uint256 indexed id, string memo)
  MEMO: "0x1ac03619c3cd8038349dc82d4190eb6ed901d9e08e60dbab3bfdbee0a153cec7",

  // B20Factory
  // B20Created(uint8 variant, address indexed creator, address indexed token, bytes32 salt)
  B20_CREATED: "0x981ebffa6c2d7329a02948ec363b890f5a1e1e370bd6414de9ba2bb7b350d78d",
} as const;

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
