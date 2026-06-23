"use client";

import { useState } from "react";
import { ConnectBar } from "@/components/ConnectBar";
import { Circles } from "@/components/Circles";
import { Streams } from "@/components/Streams";
import { Pools } from "@/components/Pools";

const MODES = [
  { key: "circles", label: "Circles", hint: "Savings circle", glyph: "↻" },
  { key: "streams", label: "Streams", hint: "Payroll", glyph: "↡" },
  { key: "pools", label: "Pools", hint: "Crowdfunding", glyph: "⇈" },
] as const;

type ModeKey = (typeof MODES)[number]["key"];

export default function Home() {
  const [mode, setMode] = useState<ModeKey>("circles");

  return (
    <main className="relative z-10 mx-auto min-h-dvh max-w-4xl px-5 py-8 sm:py-12">
      {/* Header */}
      <header className="rise mb-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <CowrieMark />
          <div>
            <h1 className="font-display text-2xl font-semibold leading-none tracking-tight">Cowrie</h1>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted">Confidential group treasury</p>
          </div>
        </div>
        <ConnectBar />
      </header>

      {/* Hero — the thesis + the demo beat */}
      <section className="rise mb-10" style={{ animationDelay: "80ms" }}>
        <h2 className="max-w-2xl font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
          Private group money on a{" "}
          <span className="italic text-coral-soft">public</span> chain.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-shell-dim">
          One engine, three modes. Contributions, salaries and donations are added, compared and paid out
          <em className="not-italic text-shell"> while the amounts stay encrypted</em> — only ever a ciphertext
          on the block explorer.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <CipherTease />
          <span className="chip">
            <span aria-hidden>🐚</span> ERC-7984
          </span>
          <span className="chip">
            <span aria-hidden>⛓</span> Sepolia
          </span>
        </div>
      </section>

      {/* Mode tabs */}
      <nav
        className="rise card mb-6 grid grid-cols-3 gap-1 p-1.5"
        style={{ animationDelay: "160ms" }}
        role="tablist"
        aria-label="Treasury modes"
      >
        {MODES.map((m) => {
          const active = m.key === mode;
          return (
            <button
              key={m.key}
              role="tab"
              aria-selected={active}
              onClick={() => setMode(m.key)}
              className={`flex flex-col gap-0.5 rounded-2xl px-4 py-3 text-left transition-colors ${
                active ? "bg-surface-2" : "hover:bg-surface-2/50"
              }`}
            >
              <span className="flex items-center gap-2 font-medium">
                <span className={active ? "text-gold" : "text-muted"} aria-hidden>
                  {m.glyph}
                </span>
                {m.label}
              </span>
              <span className="text-xs text-muted">{m.hint}</span>
            </button>
          );
        })}
      </nav>

      <div className="rise" style={{ animationDelay: "240ms" }}>
        {mode === "circles" && <Circles />}
        {mode === "streams" && <Streams />}
        {mode === "pools" && <Pools />}
      </div>

      <footer className="mt-12 flex flex-col items-center gap-1 text-center text-xs text-muted">
        <p>Built on ERC-7984 confidential tokens and FHEVM. Testnet only — no real value.</p>
      </footer>
    </main>
  );
}

/** A small cowrie-shell mark used as the brand glyph. */
function CowrieMark() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="19" fill="var(--color-surface-2)" stroke="var(--color-gold)" strokeOpacity="0.5" />
      <ellipse cx="20" cy="20" rx="9" ry="13" fill="none" stroke="var(--color-coral)" strokeWidth="1.6" />
      <path
        d="M20 8 C 18 14, 18 26, 20 32 C 22 26, 22 14, 20 8 Z"
        fill="var(--color-gold)"
        opacity="0.85"
      />
    </svg>
  );
}

/** The demo beat as a teaser: an amount becoming an opaque ciphertext handle. */
function CipherTease() {
  return (
    <span className="chip" title="Amounts are encrypted client-side before they ever touch the chain">
      <span className="text-shell-dim">5,000</span>
      <span className="text-muted" aria-hidden>
        →
      </span>
      <span className="handle">0x9f3a…e21c</span>
    </span>
  );
}
