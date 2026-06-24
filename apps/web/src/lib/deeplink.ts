"use client";

import { useEffect, useState } from "react";

const isAddress = (v: string | null): v is `0x${string}` =>
  !!v && /^0x[0-9a-fA-F]{40}$/.test(v);

/**
 * Read a shared instance address from the URL (?circle / ?stream / ?campaign),
 * hand it back once, then strip the query param so refreshes/links stay clean.
 * Uses window.location directly (no useSearchParams) to avoid Next's Suspense
 * requirement during static prerender.
 */
export function useDeepLink(param: "circle" | "stream" | "campaign"): `0x${string}` | undefined {
  const [addr, setAddr] = useState<`0x${string}` | undefined>(undefined);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const v = url.searchParams.get(param);
    if (isAddress(v)) {
      setAddr(v);
      // Defer clearing so page-level logic (e.g. switching to the right tab) can
      // still read the param this tick; then tidy the URL.
      const t = setTimeout(() => {
        const u = new URL(window.location.href);
        u.searchParams.delete(param);
        window.history.replaceState({}, "", u.pathname + u.search + u.hash);
      }, 400);
      return () => clearTimeout(t);
    }
  }, [param]);
  return addr;
}

/** Build a shareable link that deep-loads an instance for whoever opens it. */
export function shareUrl(param: "circle" | "stream" | "campaign", addr: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/?${param}=${addr}`;
}

/** Copy a shareable link to the clipboard; resolves to the copied URL. */
export async function copyShareLink(param: "circle" | "stream" | "campaign", addr: string): Promise<string> {
  const url = shareUrl(param, addr);
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(url);
  }
  return url;
}
