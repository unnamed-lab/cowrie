"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createPublicClient, webSocket } from "viem";
import { sepolia } from "viem/chains";

const WS_RPC = process.env.NEXT_PUBLIC_SEPOLIA_WS ?? "wss://ethereum-sepolia-rpc.publicnode.com";

/**
 * Real-time updates over WebSocket. A viem `fallback` transport defaults to
 * *polling* for block watching, so we open a dedicated WebSocket client and
 * subscribe to new heads (eth_subscribe('newHeads')). On each block (~12s on
 * Sepolia) we invalidate the contract reads so the dashboard streams fresh data
 * instead of waiting for the 30s poll. If the socket can't connect it simply
 * stays quiet and the 30s polling fallback keeps things fresh.
 */
export function LiveRefresh() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["readContract"] });
      queryClient.invalidateQueries({ queryKey: ["readContracts"] });
      queryClient.invalidateQueries({ queryKey: ["balance"] });
    };

    let unwatch: (() => void) | undefined;
    try {
      const client = createPublicClient({ chain: sepolia, transport: webSocket(WS_RPC) });
      unwatch = client.watchBlocks({
        emitMissed: false,
        onBlock: () => refresh(),
        onError: () => {}, // degrade silently to the 30s polling fallback
      });
    } catch {
      /* WebSocket unavailable — polling fallback covers it. */
    }

    return () => {
      try {
        unwatch?.();
      } catch {
        /* ignore */
      }
    };
  }, [queryClient]);

  return null;
}
