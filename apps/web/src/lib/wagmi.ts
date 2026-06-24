import { http, webSocket, fallback, createConfig } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

/**
 * Sepolia-only wagmi config. Cowrie runs entirely on Sepolia (chainId 11155111).
 *
 * RPC: a batched HTTP endpoint plus a WebSocket endpoint, behind viem's
 * `fallback` so a slow/failing endpoint is automatically skipped. Override the
 * HTTP endpoint with NEXT_PUBLIC_SEPOLIA_RPC (e.g. an Alchemy/Infura URL) for
 * the fastest experience.
 */
const HTTP_RPC = process.env.NEXT_PUBLIC_SEPOLIA_RPC ?? "https://ethereum-sepolia-rpc.publicnode.com";
const WS_RPC = process.env.NEXT_PUBLIC_SEPOLIA_WS ?? "wss://ethereum-sepolia-rpc.publicnode.com";

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: {
    [sepolia.id]: fallback(
      [
        http(HTTP_RPC, { batch: { wait: 16 }, timeout: 12_000 }),
        webSocket(WS_RPC, { timeout: 12_000 }),
        http("https://sepolia.drpc.org", { batch: { wait: 16 } }),
        http("https://1rpc.io/sepolia", { batch: { wait: 16 } }),
      ],
      { rank: false },
    ),
  },
  ssr: true,
});

/** The HTTP RPC used for FHE relayer reads (kept in sync with wagmi). */
export const FHE_RPC = HTTP_RPC;

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
