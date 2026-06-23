"use client";

import { ReactNode, useState } from "react";

export type StatusKind = "idle" | "working" | "done" | "error";

/** Lightweight status state for the multi-second encrypt/submit/decrypt flows. */
export function useStatus() {
  const [state, setState] = useState<{ msg: string; kind: StatusKind }>({ msg: "", kind: "idle" });
  return {
    status: state.msg,
    kind: state.kind,
    working: (msg: string) => setState({ msg, kind: "working" }),
    done: (msg: string) => setState({ msg, kind: "done" }),
    error: (msg: string) => setState({ msg, kind: "error" }),
  };
}

/** A mode panel: brass eyebrow rule, display title, lede, deploy guard. */
export function ModeCard({
  title,
  lede,
  badge,
  configured,
  children,
}: {
  title: string;
  lede: string;
  badge?: ReactNode;
  configured: boolean;
  children: ReactNode;
}) {
  return (
    <section className="card rise overflow-hidden p-6 sm:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <span className="mb-3 block h-px w-10 bg-gold/70" />
          <h2 className="font-display text-3xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-shell-dim">{lede}</p>
        </div>
        {badge}
      </div>
      {!configured ? (
        <p className="rounded-xl border border-coral/30 bg-ink px-4 py-3 text-sm text-coral-soft">
          Contracts not deployed for this chain — run <code className="handle">pnpm deploy:sepolia</code> and fill
          in <code className="handle">packages/shared/src/addresses.ts</code>.
        </p>
      ) : (
        children
      )}
    </section>
  );
}

/** Labeled numeric amount input with a cUSDT suffix + primary action. */
export function AmountRow({
  label = "Amount",
  value,
  onChange,
  onSubmit,
  cta,
  busy,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  cta: string;
  busy?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
        {label}
        <span className="relative flex items-center">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            inputMode="numeric"
            className="field w-full pr-16 text-base sm:w-52"
          />
          <span className="pointer-events-none absolute right-3 text-xs font-semibold text-muted">cUSDT</span>
        </span>
      </label>
      <button onClick={onSubmit} disabled={busy} className="btn btn-primary">
        {busy ? <Spinner /> : <span aria-hidden>🔒</span>}
        {busy ? "Working…" : cta}
      </button>
    </div>
  );
}

/** Stateful status line for the multi-second encrypt/decrypt round-trips. */
export function StatusLine({ status, kind = "idle" }: { status: string; kind?: StatusKind }) {
  if (!status) return null;
  const tone =
    kind === "error" ? "text-coral-soft" : kind === "done" ? "text-sea" : "text-shell-dim";
  return (
    <p className={`mt-5 flex items-center gap-2 text-sm ${tone}`} role="status" aria-live="polite">
      {kind === "working" && <Spinner />}
      {kind === "done" && <span aria-hidden>✓</span>}
      {kind === "error" && <span aria-hidden>⚠</span>}
      <span>{status}</span>
    </p>
  );
}

/** Truncated ciphertext handle, rendered as a deliberate "this is encrypted" mark. */
export function HandleChip({ handle, label = "on-chain" }: { handle?: string; label?: string }) {
  const short = handle && handle.length > 14 ? `${handle.slice(0, 8)}…${handle.slice(-4)}` : handle ?? "—";
  return (
    <span className="chip" title={handle}>
      <span aria-hidden>🔒</span>
      <span className="handle">{short}</span>
      <span className="text-[0.65rem] font-normal text-muted">{label}</span>
    </span>
  );
}

export function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
