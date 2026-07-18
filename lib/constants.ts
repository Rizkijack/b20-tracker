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
// All hashes are keccak256 of the canonical Solidity event signature.
// Verified via: ethers.id("<EventSignature>")
export const EVENT_TOPICS = {
  // Standard ERC-20 Transfer (also used by B20)
  TRANSFER: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", // Transfer(address,address,uint256)

  // B20-specific events
  MEMO: "0x19872106a7b684d5d23cb3a2576a0913956657fc74879f0c213c43c6facaf9d1", // Memo(address,address,uint256,string)
  MINT: "0x0f6798a560793a54c3bcfe86a93cde1e73087d944c0ea20544137d4121396885", // Mint(address,uint256)
  BURN: "0xcc16f5dbb4873280815c1ee09dbd06736cffcc184412cf7a71a0fdb75d397ca5", // Burn(address,uint256)

  // Access control (OpenZeppelin IAccessControl)
  ROLE_GRANTED: "0x2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d", // RoleGranted(bytes32,address,address)
  ROLE_REVOKED: "0xf6391f5c32d9c69d2a47ea670b442974b53935d1edc7fd64eb21e047a839171b", // RoleRevoked(bytes32,address,address)

  // Supply
  SUPPLY_CAP_UPDATED: "0xb4d96b3a6638191d0f6aefa0fdc4d99af3592f4c97480e31feeb977723c63b53", // SupplyCapUpdated(uint256,uint256)

  // Pause (OpenZeppelin Pausable)
  PAUSED: "0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258", // Paused(address)
  UNPAUSED: "0x5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa", // Unpaused(address)

  // Policy
  POLICY_UPDATED: "0x80e82abbe1b482f962c8033b4fa717eb7e0d10ee4e22e78d42b5ba1160220b88", // PolicyUpdated(address,bytes32,bytes)

  // Factory
  B20_CREATED: "0xb0ed61ac10020e747404027a57555bb822d38ff48126cf1d9cf8fed98bbcb762", // B20Created(address,uint8,address,bytes32)
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
