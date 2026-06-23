"use client";

/**
 * A dismissible onboarding guide: the four-step flow every mode shares
 * (fund → approve → act privately → decrypt your own share). Surfaces the
 * otherwise-hidden faucet and explains *why* the amounts stay private, so a
 * first-time visitor (or bounty judge) knows exactly what to do.
 */
const STEPS = [
  {
    n: 1,
    title: "Get test funds",
    body: "Mint yourself some cUSDT from the testnet faucet — that's the confidential token every mode moves.",
  },
  {
    n: 2,
    title: "Approve the pool",
    body: "A one-time operator approval lets the contract move your tokens on your behalf. No spending limit is revealed.",
  },
  {
    n: 3,
    title: "Act privately",
    body: "Contribute, fund payroll, or set a salary. Your amount is encrypted in your browser before it ever touches the chain.",
  },
  {
    n: 4,
    title: "Decrypt your share",
    body: "On the block explorer it's just a ciphertext. In the FHE Inspector you sign once to decrypt only your own balance.",
  },
];

export function QuickStart({ onGetFunds, onClose }: { onGetFunds?: () => void; onClose: () => void }) {
  return (
    <section
      className="rise card relative mb-6 overflow-hidden p-5 sm:p-6"
      aria-label="Quick start guide"
      style={{ animationDelay: "120ms" }}
    >
      <button
        onClick={onClose}
        aria-label="Dismiss quick start"
        className="absolute right-4 top-4 text-muted transition-colors hover:text-shell"
      >
        ✕
      </button>

      <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.18em] text-gold">Quick start</span>
      <h3 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
        Move money privately in four steps
      </h3>

      <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <li key={s.n} className="flex flex-col gap-2 rounded-2xl bg-ink/50 p-4">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold"
              style={{ background: "var(--color-surface-2)", color: "var(--color-gold)" }}
            >
              {s.n}
            </span>
            <span className="font-semibold text-shell">{s.title}</span>
            <span className="text-xs leading-relaxed text-shell-dim">{s.body}</span>
            {s.n === 1 && onGetFunds && (
              <button onClick={onGetFunds} className="btn btn-ghost mt-1 self-start py-1.5 text-xs">
                Get test cUSDT ↓
              </button>
            )}
          </li>
        ))}
      </ol>

      <p className="mt-4 text-[11px] text-muted">
        Runs entirely on Sepolia testnet — no real value. The point: amounts stay encrypted on a public chain while the
        contract still computes on them.
      </p>
    </section>
  );
}
