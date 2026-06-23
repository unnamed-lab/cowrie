"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";

const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

/** Wallet connect / disconnect control for the header. */
export function ConnectBar() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const injected = connectors[0];

  if (isConnected) {
    return (
      <div className="flex items-center gap-3">
        {chain && chain.id !== 11155111 && (
          <span className="chip border-coral/40 text-coral-soft">Switch to Sepolia</span>
        )}
        <span className="chip">
          <span className="h-2 w-2 rounded-full bg-sea" aria-hidden />
          <span className="handle text-shell">{short(address)}</span>
        </span>
        <button onClick={() => disconnect()} className="btn btn-ghost">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => injected && connect({ connector: injected })}
      disabled={isPending || !injected}
      className="btn btn-primary"
    >
      {isPending ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
