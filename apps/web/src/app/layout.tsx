import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Editorial high-contrast serif for display, a warm grotesque for body, mono for
// ciphertext handles. Distinctive on purpose — no Inter/Roboto/system defaults.
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["opsz", "SOFT"],
  style: ["normal", "italic"],
  display: "swap",
  fallback: ["Georgia", "ui-serif", "serif"],
});
const body = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "monospace"],
});

export const metadata: Metadata = {
  title: "Cowrie — Confidential Group Treasury",
  description:
    "One FHE treasury engine, three modes: Circles, Streams, and Pools. Amounts stay encrypted on a public chain.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      {/* Browser extensions (Grammarly, etc.) inject attributes onto <body> after
          the server render, which React would otherwise flag as a hydration
          mismatch. Suppressing here is the recommended, narrowly-scoped fix. */}
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
