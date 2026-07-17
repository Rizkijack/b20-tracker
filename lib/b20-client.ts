// Re-export pure utility functions only (no RPC calls - those go through API routes)
// This file kept for backward compatibility

export {
  isB20Address,
  truncateAddress,
  formatAmount,
  formatNumber,
  detectVariant,
} from "./b20-client-utils";
