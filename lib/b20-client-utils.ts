// Client-side utility functions (pure, no RPC calls)
// Separated from RPC functions that go through API routes

import { B20_ADDRESS_PREFIX, B20Variant } from "./constants";

// ─── Helper: Check if address is a B20 token ───────────────────────────────
export function isB20Address(address: string): boolean {
  return address.toLowerCase().startsWith(B20_ADDRESS_PREFIX.toLowerCase());
}

// ─── Helper: Truncate address for display ──────────────────────────────────
export function truncateAddress(address: string, chars = 6): string {
  if (!address) return "";
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// ─── Helper: Format token amount with decimals ────────────────────────────
export function formatAmount(amount: bigint, decimals: number): string {
  if (amount === BigInt(0)) return "0";
  const divisor = BigInt(10 ** decimals);
  const integer = amount / divisor;
  const fractional = amount % divisor;
  if (fractional === BigInt(0)) {
    return integer.toLocaleString();
  }
  const fractionalStr = fractional.toString().padStart(decimals, "0").slice(0, 4);
  return `${integer.toLocaleString()}.${fractionalStr}`;
}

// ─── Helper: Format large numbers ───────────────────────────────────────────
export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

// ─── Detect token variant from address ─────────────────────────────────────
export function detectVariant(address: string): "asset" | "stablecoin" {
  try {
    const cleaned = address.toLowerCase().replace("0x", "");
    if (cleaned.length >= 22) {
      const variantHex = cleaned.slice(20, 22);
      const variantInt = parseInt(variantHex, 16);
      return variantInt === B20Variant.STABLECOIN ? "stablecoin" : "asset";
    }
  } catch {
    // ignore
  }
  return "asset";
}
