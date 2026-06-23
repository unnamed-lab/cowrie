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
          <span className="text-sm" style={{ color: "var(--color-coral)" }}>
            Switch to Sepolia
          </span>
        )}
        <span className="handle" style={{ color: "var(--color-shell)" }}>
          {short(address)}
        </span>
        <button
          onClick={() => disconnect()}
          className="rounded-full border px-4 py-2 text-sm"
          style={{ borderColor: "var(--color-muted)", color: "var(--color-shell)" }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => injected && connect({ connector: injected })}
      disabled={isPending || !injected}
      className="rounded-full px-5 py-2 text-sm font-medium"
      style={{ background: "var(--color-coral)", color: "var(--color-ink)" }}
    >
      {isPending ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
