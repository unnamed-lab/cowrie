"use client";

import { Spinner } from "./ui";

/**
 * Header balance indicator. Your cUSDT balance is encrypted on-chain, so we can't
 * show it passively — instead we show that it's confidential and let you reveal it
 * in one click (a local EIP-712 decryption). Answers "how much do I have?" from
 * anywhere on the page; stays in sync with the footer FHE Inspector.
 */
export function BalancePill({
  hasHandle,
  decrypted,
  decrypting,
  onReveal,
}: {
  hasHandle: boolean;
  decrypted: string | null;
  decrypting: boolean;
  onReveal: () => void;
}) {
  if (decrypted !== null) {
    return (
      <button
        onClick={onReveal}
        title="Re-decrypt (refresh after a mint or transfer)"
        className="chip cursor-pointer transition-colors hover:border-sea/40"
        type="button"
      >
        <span className="h-2 w-2 rounded-full bg-sea" aria-hidden />
        <span className="font-semibold text-shell">{Number(decrypted).toLocaleString()}</span>
        <span className="text-[10px] font-semibold text-muted">cUSDT</span>
        <span className="text-muted" aria-hidden>↻</span>
      </button>
    );
  }

  return (
    <button
      onClick={onReveal}
      disabled={!hasHandle || decrypting}
      title={hasHandle ? "Decrypt your confidential balance" : "No balance yet — use the faucet"}
      className="chip cursor-pointer transition-colors hover:border-gold/40 disabled:opacity-50"
      type="button"
    >
      {decrypting ? <Spinner /> : <span aria-hidden>🔒</span>}
      <span className="text-shell-dim">{decrypting ? "Decrypting…" : "Reveal balance"}</span>
    </button>
  );
}
