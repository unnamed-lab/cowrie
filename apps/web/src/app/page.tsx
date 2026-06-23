"use client";

import { useState } from "react";
import { ConnectBar } from "@/components/ConnectBar";
import { Circles } from "@/components/Circles";
import { Streams } from "@/components/Streams";
import { Pools } from "@/components/Pools";

const MODES = [
  { key: "circles", label: "Circles", hint: "Savings circle" },
  { key: "streams", label: "Streams", hint: "Payroll" },
  { key: "pools", label: "Pools", hint: "Crowdfunding" },
] as const;

type ModeKey = (typeof MODES)[number]["key"];

export default function Home() {
  const [mode, setMode] = useState<ModeKey>("circles");

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-8 sm:py-12">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Cowrie
          </h1>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            One engine, three modes for private group money. Amounts stay encrypted on-chain.
          </p>
        </div>
        <ConnectBar />
      </header>

      <nav className="mb-6 flex gap-2" role="tablist" aria-label="Treasury modes">
        {MODES.map((m) => {
          const active = m.key === mode;
          return (
            <button
              key={m.key}
              role="tab"
              aria-selected={active}
              onClick={() => setMode(m.key)}
              className="flex-1 rounded-2xl px-4 py-3 text-left transition-colors"
              style={{
                background: active ? "var(--color-ink-soft)" : "transparent",
                border: `1px solid ${active ? "var(--color-gold)" : "var(--color-muted)"}`,
              }}
            >
              <span className="block font-medium">{m.label}</span>
              <span className="block text-xs" style={{ color: "var(--color-muted)" }}>
                {m.hint}
              </span>
            </button>
          );
        })}
      </nav>

      {mode === "circles" && <Circles />}
      {mode === "streams" && <Streams />}
      {mode === "pools" && <Pools />}

      <footer className="mt-10 text-center text-xs" style={{ color: "var(--color-muted)" }}>
        Built on ERC-7984 confidential tokens and the Zama FHEVM. Testnet only.
      </footer>
    </main>
  );
}
