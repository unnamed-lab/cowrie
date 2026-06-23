import type { Metadata, Viewport } from "next";
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cowrie-treasury.vercel.app";

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

const TITLE = "Cowrie — Confidential Group Treasury";
const DESCRIPTION =
  "One FHE engine, three modes — savings circles, confidential payroll, and crowdfunding. Amounts stay encrypted on a public chain while the contract still computes on them.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s — Cowrie",
  },
  description: DESCRIPTION,
  applicationName: "Cowrie",
  keywords: [
    "FHE",
    "FHEVM",
    "confidential tokens",
    "ERC-7984",
    "private DeFi",
    "ROSCA",
    "esusu",
    "chama",
    "stokvel",
    "confidential payroll",
    "crowdfunding",
    "Sepolia",
    "Zama",
    "composable privacy",
  ],
  authors: [{ name: "Cowrie" }],
  creator: "Cowrie",
  openGraph: {
    type: "website",
    siteName: "Cowrie",
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#100e1a",
  colorScheme: "dark",
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
