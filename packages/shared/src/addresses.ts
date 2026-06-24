/**
 * Deployed Cowrie contract addresses, keyed by chain id.
 *
 * Fill these in after running `pnpm deploy:sepolia` (the deploy script prints
 * them). The Sepolia chain id is 11155111. Until deployed, the web app surfaces
 * a "not configured" state rather than calling the zero address.
 */
export const ADDRESSES = {
  // Ethereum Sepolia. Only the token + factories are fixed infrastructure;
  // circles/streams/campaigns are created by users through the factories.
  11155111: {
    ConfidentialUSDT: "0x3f2569498053a8c7266839Ab8a4256765004970f",
    SavingsCircleFactory: "0x57e6698810bCee8e50ec25c2e15754cAD2e7a978",
    CrowdfundFactory: "0xaABd99a2530A8Ced89fb8e67f0746586088ba371",
    PayrollStreamsFactory: "0x0283592e5EB6f5aa058d911e71ED560d4AaD0C0F",
  },
} as const;

export type SupportedChainId = keyof typeof ADDRESSES;
export type ContractName = keyof (typeof ADDRESSES)[11155111];

export const SEPOLIA_CHAIN_ID = 11155111 as const;

export function getAddresses(chainId: number) {
  return ADDRESSES[chainId as SupportedChainId];
}

export function isConfigured(chainId: number): boolean {
  const a = getAddresses(chainId);
  const ZERO = "0x0000000000000000000000000000000000000000";
  return !!a && Object.values(a).every((addr) => (addr as string) !== ZERO);
}
