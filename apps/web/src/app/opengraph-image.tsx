import { ImageResponse } from "next/og";

// Branded 1200x630 social card. Uses divs (no SVG/custom-font fetch) so it
// renders reliably at build time. Cowrie palette: cowrie-cream on deep indigo,
// brass shell mark, coral accent.
export const runtime = "nodejs";
export const alt = "Cowrie — Confidential Group Treasury. Private group money on a public chain.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#100e1a";
const SHELL = "#f4ecdd";
const SHELL_DIM = "#cfc6b8";
const CORAL = "#e6764e";
const GOLD = "#d4ab36";
const SEA = "#4bb1a3";
const MUTED = "#7c7791";

function Chip({ children, color = SHELL_DIM }: { children: string; color?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        border: "1px solid rgba(244,236,221,0.14)",
        borderRadius: 999,
        padding: "10px 20px",
        fontSize: 24,
        color,
        background: "rgba(244,236,221,0.04)",
      }}
    >
      {children}
    </div>
  );
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          backgroundColor: INK,
          backgroundImage:
            "linear-gradient(135deg, rgba(230,118,78,0.20) 0%, rgba(16,14,26,0) 42%), linear-gradient(300deg, rgba(75,177,163,0.16) 0%, rgba(16,14,26,0) 45%)",
          color: SHELL,
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {/* Cowrie shell mark */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 72,
              height: 96,
              borderRadius: "50%",
              background: GOLD,
            }}
          >
            <div style={{ width: 10, height: 70, borderRadius: 6, background: "#2a1f06" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: -1 }}>Cowrie</div>
            <div style={{ fontSize: 22, letterSpacing: 6, color: MUTED, textTransform: "uppercase" }}>
              Confidential Group Treasury
            </div>
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", flexWrap: "wrap", fontSize: 88, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
            <span>Private group money on a&nbsp;</span>
            <span style={{ color: CORAL, fontStyle: "italic" }}>public</span>
            <span>&nbsp;chain.</span>
          </div>
          <div style={{ display: "flex", fontSize: 30, color: SHELL_DIM, maxWidth: 980 }}>
            One engine, three modes — amounts stay encrypted on-chain while the contract still computes on them.
          </div>
        </div>

        {/* Footer chips */}
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Chip color={GOLD}>Circles</Chip>
          <Chip color={CORAL}>Streams</Chip>
          <Chip color={SEA}>Pools</Chip>
          <div style={{ display: "flex", flex: 1 }} />
          <Chip>ERC-7984 · FHEVM · Sepolia</Chip>
        </div>
      </div>
    ),
    { ...size },
  );
}
