"use client";

import { CowrieIcon } from "./CowrieIcon";

/**
 * The Cowrie signature element: a row of cowrie-shell glyphs that fills as members
 * contribute this round. It shows *participation* (how many have paid in) without
 * ever showing *amounts* — privacy made visible, which is the whole point.
 */
export function ShellMeter({ filled, total, label }: { filled: number; total: number; label?: string }) {
  const count = Math.max(total, 1);
  const shells = Array.from({ length: count }, (_, i) => i < filled);

  return (
    <div className="flex flex-col gap-3" aria-label={label ?? `${filled} of ${total} contributed`}>
      <div className="flex flex-wrap gap-2.5" role="img">
        {shells.map((isFilled, i) => (
          <Shell key={i} filled={isFilled} index={i} />
        ))}
      </div>
      <span className="text-sm text-shell-dim font-medium">
        <span className="font-display text-base text-gold font-semibold">{filled}</span>
        <span className="text-muted"> / {total} contributed this round</span>
      </span>
    </div>
  );
}

function Shell({ filled, index }: { filled: boolean; index: number }) {
  return (
    <div
      className={filled ? "shell-pop" : "opacity-60"}
      style={{ animationDelay: `${index * 60}ms` }}
      aria-hidden
    >
      <CowrieIcon filled={filled} size={28} glow={filled} />
    </div>
  );
}
