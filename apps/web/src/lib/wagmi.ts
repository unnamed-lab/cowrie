import { http, createConfig } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

/**
 * Minimal wagmi config: Sepolia only, injected (MetaMask/Rabbit/etc.) connector.
 * Cowrie runs entirely on Sepolia (chainId 11155111) where the Zama FHEVM host
 * contracts live.
 */
export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
