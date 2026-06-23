/**
 * Deployed Cowrie contract addresses, keyed by chain id.
 *
 * Fill these in after running `pnpm deploy:sepolia` (the deploy script prints
 * them). The Sepolia chain id is 11155111. Until deployed, the web app surfaces
 * a "not configured" state rather than calling the zero address.
 */
export const ADDRESSES = {
  // Ethereum Sepolia
  11155111: {
    ConfidentialUSDT: "0x3f2569498053a8c7266839Ab8a4256765004970f",
    SavingsCircle: "0xF2BD85f25146440a6B1043Ffb9d5A72492Eb9BDC",
    PayrollStreams: "0x17037e134a8Ef4a79A9a37c0Df6C0a3d758A2B2d",
    Crowdfund: "0xbF3B0Db37498B4CA0902e6Fe92f75BDD7e4252fb",
    SavingsCircleFactory: "0x29c73523715481DF8D3efcbB9ae4007DDF0a38dd",
    CrowdfundFactory: "0x138c6F5cF81da96aeb8B25EC61109687fdA98872",
    PayrollStreamsFactory: "0xe0AFccDEC573DE5C96484795AF38a63C78255b2c",
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
