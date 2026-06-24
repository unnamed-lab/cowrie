"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { LiveRefresh } from "@/components/LiveRefresh";

/** Wallet + data-fetching providers. Client-only (wagmi needs the browser). */
export function Providers({ children }: { children: React.ReactNode }) {
  // On-chain reads auto-refresh so the UI doesn't go stale behind a slow RPC:
  // poll every 30s, refetch on focus/reconnect, and retry transient failures.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchInterval: 30_000,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            staleTime: 10_000,
            retry: 2,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <LiveRefresh />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
