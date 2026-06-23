"use client";

/**
 * The Cowrie signature element: a row of cowrie-shell glyphs that fills as
 * members contribute this round. It shows *participation* (how many have paid in)
 * without ever showing *amounts* — privacy made visible, which is the whole point.
 */
export function ShellMeter({
  filled,
  total,
  label,
}: {
  filled: number;
  total: number;
  label?: string;
}) {
  const shells = Array.from({ length: Math.max(total, 1) }, (_, i) => i < filled);

  return (
    <div className="flex flex-col gap-2" aria-label={label ?? `${filled} of ${total} contributed`}>
      <div className="flex flex-wrap gap-2" role="img">
        {shells.map((isFilled, i) => (
          <span
            key={i}
            className="text-2xl leading-none transition-colors"
            style={{ color: isFilled ? "var(--color-gold)" : "var(--color-muted)" }}
            aria-hidden
          >
            {/* cowrie-shell motif */}
            {isFilled ? "◉" : "◌"}
          </span>
        ))}
      </div>
      <span className="text-sm" style={{ color: "var(--color-muted)" }}>
        {label ?? `${filled} / ${total} contributed this round`}
      </span>
    </div>
  );
}
