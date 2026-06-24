"use client";

import { ReactNode, useState } from "react";
import { LockIcon, CheckIcon, AlertIcon } from "./Icons";
import { formatTxError } from "@/lib/errors";

export type StatusKind = "idle" | "working" | "done" | "error";

/** Lightweight status state for the multi-second encrypt/submit/decrypt flows. */
export function useStatus() {
  const [state, setState] = useState<{ msg: string; kind: StatusKind }>({ msg: "", kind: "idle" });
  return {
    status: state.msg,
    kind: state.kind,
    working: (msg: string) => setState({ msg, kind: "working" }),
    done: (msg: string) => setState({ msg, kind: "done" }),
    // Accepts a raw error (or string) and renders one short, human sentence.
    error: (e: unknown) => setState({ msg: formatTxError(e), kind: "error" }),
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
    <section className="card rise overflow-hidden p-6 sm:p-8 relative">
      {/* Decorative ambient gold glow on top-right of cards */}
      <div className="absolute top-0 right-0 -z-10 h-32 w-32 rounded-full bg-gold/5 blur-[50px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 -z-10 h-32 w-32 rounded-full bg-coral/5 blur-[60px] pointer-events-none" />

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <span className="mb-3 block h-px w-10 bg-gradient-to-r from-gold to-transparent" />
          <h2 className="font-display text-3xl font-semibold tracking-tight text-gradient bg-gradient-to-r from-shell via-shell-dim to-gold bg-clip-text text-transparent">{title}</h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-shell-dim font-medium">{lede}</p>
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
  disabled,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  cta: string;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted tracking-wider uppercase">
        {label}
        <span className="relative flex items-center mt-1">
          <input
            value={value}
            disabled={disabled || busy}
            onChange={(e) => onChange(e.target.value)}
            inputMode="numeric"
            className="field w-full pr-16 text-base sm:w-52"
          />
          <span className="pointer-events-none absolute right-4 text-xs font-bold text-gold">cUSDT</span>
        </span>
      </label>
      <button onClick={onSubmit} disabled={disabled || busy} className="btn btn-primary self-start sm:self-auto">
        {busy ? <Spinner /> : <LockIcon className="h-3.5 w-3.5" />}
        {busy ? "Encrypting..." : cta}
      </button>
    </div>
  );
}

/** Stateful status line for the multi-second encrypt/decrypt round-trips. */
export function StatusLine({ status, kind = "idle" }: { status: string; kind?: StatusKind }) {
  if (!status) return null;

  const config = {
    idle: { bg: "bg-surface-2/20 border-surface-2/60", text: "text-shell-dim", icon: <span className="text-xs">i</span> },
    working: { bg: "bg-gold/5 border-gold/20", text: "text-gold", icon: null },
    done: { bg: "bg-sea/5 border-sea/25", text: "text-sea", icon: <CheckIcon className="h-3 w-3" /> },
    error: { bg: "bg-coral/5 border-coral/20", text: "text-coral-soft", icon: <AlertIcon className="h-3 w-3" /> },
  }[kind];

  return (
    <div 
      className={`mt-5 flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm transition-all duration-300 ${config.bg} ${config.text}`}
      role="status" 
      aria-live="polite"
    >
      {kind === "working" ? (
        <Spinner />
      ) : (
        <span className="font-bold text-sm h-5 w-5 rounded-full flex items-center justify-center bg-current/10" aria-hidden>
          {config.icon}
        </span>
      )}
      <span className="flex-1 font-semibold leading-snug">{status}</span>
    </div>
  );
}

/** Truncated ciphertext handle, rendered as a deliberate "this is encrypted" mark. */
export function HandleChip({ handle, label = "on-chain" }: { handle?: string; label?: string }) {
  const short = handle && handle.length > 14 ? `${handle.slice(0, 8)}…${handle.slice(-4)}` : handle ?? "—";
  return (
    <span className="chip" title={handle}>
      <LockIcon className="h-3 w-3 text-gold" />
      <span className="handle">{short}</span>
      <span className="text-[0.65rem] font-bold text-muted uppercase tracking-wider">{label}</span>
    </span>
  );
}

export function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-current" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
