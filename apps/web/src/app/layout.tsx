import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Cowrie — Confidential Group Treasury",
  description:
    "One FHE treasury engine, three modes: Circles, Streams, and Pools. Amounts stay encrypted on a public chain.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
