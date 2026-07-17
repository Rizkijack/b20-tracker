// Server-side ethers.js provider utilities
// Only imported in API routes, never in client components

import { JsonRpcProvider } from "ethers";
import { BASE_MAINNET_RPC, B20_ADDRESS_PREFIX } from "./constants";

let provider: JsonRpcProvider | null = null;

export function getProvider(): JsonRpcProvider {
  if (!provider) {
    provider = new JsonRpcProvider(BASE_MAINNET_RPC, 8453); // Base chainId
  }
  return provider;
}

// ─── Helper: Check if address is a B20 token ───────────────────────────────
export function isB20Address(address: string): boolean {
  return address.toLowerCase().startsWith(B20_ADDRESS_PREFIX.toLowerCase());
}
