"use client";

import { ReactNode } from "react";

/** A single mode panel with title, lede, and a "not deployed yet" guard. */
export function ModeCard({
  title,
  lede,
  configured,
  children,
}: {
  title: string;
  lede: string;
  configured: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-3xl p-6 sm:p-8"
      style={{ background: "var(--color-ink-soft)" }}
    >
      <h2 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
        {title}
      </h2>
      <p className="mt-1 mb-6 max-w-prose text-sm" style={{ color: "var(--color-muted)" }}>
        {lede}
      </p>
      {!configured ? (
        <p
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--color-ink)", color: "var(--color-coral)" }}
        >
          Contracts not deployed yet — run <code>pnpm deploy:sepolia</code> and fill in
          <code> packages/shared/src/addresses.ts</code>.
        </p>
      ) : (
        children
      )}
    </section>
  );
}

/** Numeric amount input + primary action button. */
export function AmountRow({
  value,
  onChange,
  onSubmit,
  cta,
  busy,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  cta: string;
  busy?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        aria-label="Amount"
        className="w-full rounded-full px-4 py-2 sm:w-40"
        style={{ background: "var(--color-ink)", color: "var(--color-shell)" }}
      />
      <button
        onClick={onSubmit}
        disabled={busy}
        className="rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
        style={{ background: "var(--color-coral)", color: "var(--color-ink)" }}
      >
        {busy ? "Working…" : cta}
      </button>
    </div>
  );
}

/** Status / progress line for the multi-second encrypt/decrypt round-trips. */
export function StatusLine({ status }: { status: string }) {
  if (!status) return null;
  return (
    <p className="mt-4 text-sm" style={{ color: "var(--color-sea)" }}>
      {status}
    </p>
  );
}
