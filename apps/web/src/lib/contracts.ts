"use client";

import { useChainId } from "wagmi";
import {
  getAddresses,
  isConfigured,
  SEPOLIA_CHAIN_ID,
  TOKEN_ABI,
  CIRCLE_ABI,
  PAYROLL_ABI,
  CROWDFUND_ABI,
  FACTORY_ABI,
  CROWDFUND_FACTORY_ABI,
  PAYROLL_FACTORY_ABI,
} from "@cowrie/shared";

export { TOKEN_ABI, CIRCLE_ABI, PAYROLL_ABI, CROWDFUND_ABI, FACTORY_ABI, CROWDFUND_FACTORY_ABI, PAYROLL_FACTORY_ABI };

/** One day, the default operator-approval window. */
export const OPERATOR_WINDOW_SECONDS = 24 * 60 * 60;

/** Resolve the deployed Cowrie addresses for the active chain (defaults to Sepolia). */
export function useCowrieAddresses() {
  const chainId = useChainId();
  const resolved = getAddresses(chainId) ?? getAddresses(SEPOLIA_CHAIN_ID);
  return {
    chainId,
    addresses: resolved,
    configured: isConfigured(chainId) || isConfigured(SEPOLIA_CHAIN_ID),
  };
}

/** uint48 operator-approval expiry, `seconds` from now. abitype maps uint48 to `number`. */
export function operatorUntil(): number {
  return Math.floor(Date.now() / 1000) + OPERATOR_WINDOW_SECONDS;
}
