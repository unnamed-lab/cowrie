"use client";

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
      <span className="text-sm text-shell-dim">
        <span className="font-display text-base text-gold">{filled}</span>
        <span className="text-muted"> / {total} contributed this round</span>
      </span>
    </div>
  );
}

function Shell({ filled, index }: { filled: boolean; index: number }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 32 32"
      className={filled ? "shell-pop" : ""}
      style={{ animationDelay: `${index * 60}ms` }}
      aria-hidden
    >
      {/* cowrie shell: an oval body with a toothed central slit */}
      <ellipse
        cx="16"
        cy="16"
        rx="9"
        ry="13"
        fill={filled ? "var(--color-gold)" : "transparent"}
        stroke={filled ? "var(--color-gold)" : "var(--color-muted)"}
        strokeWidth="1.5"
        opacity={filled ? 1 : 0.5}
      />
      <path
        d="M16 5 C 14.5 11, 14.5 21, 16 27 C 17.5 21, 17.5 11, 16 5 Z"
        fill={filled ? "#2a1f06" : "transparent"}
        stroke={filled ? "#2a1f06" : "var(--color-muted)"}
        strokeWidth="1"
        opacity={filled ? 0.9 : 0.4}
      />
      {filled &&
        [9, 12, 15, 18, 21].map((y) => (
          <line key={y} x1="13.5" y1={y} x2="18.5" y2={y} stroke="var(--color-gold)" strokeWidth="0.8" />
        ))}
    </svg>
  );
}
