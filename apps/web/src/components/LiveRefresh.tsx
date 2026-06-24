"use client";

import { useEffect } from "react";
import { useBlockNumber } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Real-time updates: subscribe to new blocks over the WebSocket RPC and refresh
 * on-chain reads the moment a block lands (≈ every 12s on Sepolia), rather than
 * waiting for the 30s poll. viem routes the eth_subscribe to the WSS endpoint in
 * the transport fallback; if the socket is unavailable it degrades to polling.
 */
export function LiveRefresh() {
  const queryClient = useQueryClient();
  const { data: blockNumber } = useBlockNumber({ watch: true });

  useEffect(() => {
    if (blockNumber === undefined) return;
    // Refresh contract reads (and the wallet balance handle) on each new block.
    queryClient.invalidateQueries({ queryKey: ["readContract"] });
    queryClient.invalidateQueries({ queryKey: ["readContracts"] });
  }, [blockNumber, queryClient]);

  return null;
}
