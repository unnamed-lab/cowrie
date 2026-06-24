"use client";

import { useState, useEffect } from "react";
import { ConnectBar } from "@/components/ConnectBar";
import { Circles } from "@/components/Circles";
import { Streams } from "@/components/Streams";
import { Pools } from "@/components/Pools";
import { QuickStart } from "@/components/QuickStart";
import { BalancePill } from "@/components/BalancePill";
import { CowrieIcon } from "@/components/CowrieIcon";
import { useAccount, useReadContract, useWriteContract, useSignTypedData } from "wagmi";
import { TOKEN_ABI, useCowrieAddresses } from "@/lib/contracts";
import { decryptHandle } from "@/fhe/useUserDecrypt";
import { HandleChip, StatusLine, useStatus } from "@/components/ui";
import { ToolsIcon, KeyIcon, LinkIcon, LockIcon } from "@/components/Icons";

const MODES = [
  { key: "circles", label: "Circles", hint: "Esusu / Chama / Stokvel", glyph: "↻" },
  { key: "streams", label: "Streams", hint: "Confidential Payroll", glyph: "↡" },
  { key: "pools", label: "Pools", hint: "Harambee Crowdfund", glyph: "⇈" },
] as const;

type ModeKey = (typeof MODES)[number]["key"];

export default function Home() {
  const [mode, setMode] = useState<ModeKey>("circles");

  // First-visit onboarding guide (remembered via localStorage; mounted-gated to
  // avoid an SSR/client hydration mismatch).
  const [guideOpen, setGuideOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("cowrie_guide_seen")) setGuideOpen(true);
    // A shared deep link (?campaign / ?stream / ?circle) should open the matching
    // tab. The mode component reads + clears the param shortly after, to load it.
    const q = new URLSearchParams(window.location.search);
    if (q.has("campaign")) setMode("pools");
    else if (q.has("stream")) setMode("streams");
    else if (q.has("circle")) setMode("circles");
  }, []);
  function closeGuide() {
    setGuideOpen(false);
    if (typeof window !== "undefined") localStorage.setItem("cowrie_guide_seen", "1");
  }
  function openFaucet() {
    setFaucetOpen(true);
    if (typeof document !== "undefined") {
      document.getElementById("faucet")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
  const { address, isConnected } = useAccount();
  const { addresses, configured } = useCowrieAddresses();
  const token = addresses?.ConfidentialUSDT as `0x${string}` | undefined;

  // Faucet state
  const { writeContractAsync, isPending: faucetPending } = useWriteContract();
  const faucetStatus = useStatus();
  const [faucetAmount, setFaucetAmount] = useState("1000");
  const [faucetOpen, setFaucetOpen] = useState(false);

  // Decryption state
  const { data: balanceHandle, refetch: refetchBalance } = useReadContract({
    abi: TOKEN_ABI,
    address: token,
    functionName: "confidentialBalanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!token && !!address && configured },
  });

  const { signTypedDataAsync } = useSignTypedData();
  const [decryptedBalance, setDecryptedBalance] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const decryptStatus = useStatus();

  // Construct TypedDataSigner using wagmi's signTypedDataAsync hook
  const signer = address ? {
    address,
    signTypedData: async (args: any) => {
      return signTypedDataAsync({
        domain: args.domain,
        types: args.types,
        primaryType: args.primaryType,
        message: args.message,
      });
    }
  } : undefined;

  async function callFaucet() {
    if (!token) return;
    try {
      faucetStatus.working("Minting test cUSDT from the contract faucet...");
      await writeContractAsync({
        abi: TOKEN_ABI,
        address: token,
        functionName: "faucet",
        args: [BigInt(faucetAmount)],
      });
      faucetStatus.done(`Successfully minted ${Number(faucetAmount).toLocaleString()} test cUSDT!`);
      // Refetch balance handle
      setTimeout(() => refetchBalance(), 1000);
    } catch (e) {
      faucetStatus.error((e as Error).message);
    }
  }

  async function performDecryption() {
    if (!balanceHandle || !token || !signer) return;
    try {
      setDecrypting(true);
      setDecryptedBalance(null);
      decryptStatus.working("Requesting signature to authenticate decryption request...");
      const result = await decryptHandle(balanceHandle as string, token, signer);
      setDecryptedBalance(String(result));
      decryptStatus.done("Decryption completed locally via EIP-712 authorization.");
    } catch (e) {
      decryptStatus.error((e as Error).message);
    } finally {
      setDecrypting(false);
    }
  }

  return (
    <main className="relative z-10 mx-auto min-h-dvh max-w-4xl px-5 py-8 sm:py-12 flex flex-col justify-between">
      <div>
        {/* Header */}
        <header className="rise mb-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CowrieIcon filled={true} size={42} glow={true} className="hover:rotate-12 transition-transform duration-300" />
            <div>
              <h1 className="font-display text-2xl font-bold leading-none tracking-tight">Cowrie</h1>
              <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-muted font-bold">Confidential group treasury</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {isConnected && configured && (
              <BalancePill
                hasHandle={!!balanceHandle}
                decrypted={decryptedBalance}
                decrypting={decrypting}
                onReveal={performDecryption}
              />
            )}
            <ConnectBar />
          </div>
        </header>

        {/* Hero */}
        <section className="rise mb-10 relative" style={{ animationDelay: "80ms" }}>
          <div className="absolute -left-12 -top-10 -z-10 h-40 w-40 rounded-full bg-coral/5 blur-[80px] pointer-events-none" />
          <h2 className="max-w-2xl font-display text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl bg-gradient-to-r from-shell via-shell-dim to-shell-dim bg-clip-text text-transparent">
            Private group money on a{" "}
            <span className="italic bg-gradient-to-r from-coral-soft to-coral bg-clip-text text-transparent font-semibold">public</span> chain.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-shell-dim font-medium">
            One engine, three modes. Contributions, salaries and donations are added, compared and paid out
            <span className="text-gold font-semibold"> while the amounts stay encrypted</span> — only ever a ciphertext
            on the block explorer.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <CipherTease />
            <span className="chip">
              <CowrieIcon filled={true} size={14} />
              <span>ERC-7984</span>
            </span>
            <span className="chip">
              <LinkIcon className="h-3.5 w-3.5 text-sea" />
              <span>Sepolia</span>
            </span>
            <button
              onClick={() => setGuideOpen(true)}
              className="chip cursor-pointer transition-colors hover:border-gold/40 hover:text-gold"
              type="button"
            >
              <span aria-hidden>?</span>
              <span>New here? Quick start</span>
            </button>
          </div>
        </section>

        {/* Onboarding guide */}
        {mounted && guideOpen && <QuickStart onGetFunds={openFaucet} onClose={closeGuide} />}

        {/* Mode tabs */}
        <nav
          className="rise card mb-6 grid grid-cols-3 gap-1.5 p-1.5 backdrop-blur-md border-shell/5"
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
                className={`flex flex-col gap-0.5 rounded-2xl px-4 py-3.5 text-left transition-all duration-300 cursor-pointer ${
                  active 
                    ? "bg-surface-2/80 shadow-[0_0_12px_rgba(212,171,54,0.08)] border border-gold/15" 
                    : "hover:bg-surface-2/40 border border-transparent"
                }`}
              >
                <span className="flex items-center gap-2 font-semibold text-sm sm:text-base">
                  <span className={`text-base transition-transform duration-300 ${active ? "text-gold scale-110" : "text-muted"}`} aria-hidden>
                    {m.glyph}
                  </span>
                  {m.label}
                </span>
                <span className="text-[10px] text-muted font-bold uppercase tracking-wider mt-0.5">{m.hint}</span>
              </button>
            );
          })}
        </nav>

        <div className="rise" style={{ animationDelay: "240ms" }}>
          {mode === "circles" && <Circles />}
          {mode === "streams" && <Streams />}
          {mode === "pools" && <Pools />}
        </div>
      </div>

      <div className="mt-12 flex flex-col items-center gap-6 text-center text-xs text-muted">
        {/* Collapsible Test Faucet Drawer */}
        {configured && (
          <div id="faucet" className="w-full max-w-2xl bg-surface/50 border border-shell/5 rounded-2xl overflow-hidden shadow-lg backdrop-blur-md transition-all duration-300 scroll-mt-6">
            <button
              onClick={() => setFaucetOpen(!faucetOpen)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-2/30 transition-colors font-semibold text-shell-dim hover:text-shell cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <ToolsIcon className="h-4 w-4 text-gold" />
                <span>Developer Testing Faucet &amp; FHE Inspector</span>
              </div>
              <span>{faucetOpen ? "Hide" : "Show"}</span>
            </button>

            {faucetOpen && (
              <div className="px-5 pb-5 pt-3 text-left border-t border-shell/5 grid gap-6 sm:grid-cols-2">
                {/* Minting Column */}
                <div className="flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gold mb-1">USDT Faucet</h4>
                    <p className="text-[11px] text-muted leading-relaxed mb-4">
                      Mint clear amounts of test cUSDT to your address. The contract handles FHE encryption under the hood.
                    </p>
                  </div>
                  <div className="flex items-end gap-2.5">
                    <label className="flex flex-col gap-1 text-[10px] font-bold text-muted uppercase tracking-wider">
                      Amount
                      <input
                        value={faucetAmount}
                        onChange={(e) => setFaucetAmount(e.target.value)}
                        inputMode="numeric"
                        className="field w-28 text-sm mt-1 py-1.5 px-3"
                      />
                    </label>
                    <button
                      onClick={callFaucet}
                      disabled={faucetPending || !isConnected}
                      className="btn btn-primary text-xs py-2 px-4 h-9"
                    >
                      {faucetPending ? "Minting..." : "Mint cUSDT"}
                    </button>
                  </div>
                  <StatusLine status={faucetStatus.status} kind={faucetStatus.kind} />
                </div>

                {/* Private Inspector Column */}
                <div className="flex flex-col justify-between border-t sm:border-t-0 sm:border-l border-shell/5 pt-4 sm:pt-0 sm:pl-6">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-sea mb-1">Confidential Balance</h4>
                    <p className="text-[11px] text-muted leading-relaxed mb-4">
                      Your balance is stored on-chain as an encrypted ciphertext handle. Prove ownership to decrypt it locally.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    {isConnected ? (
                      <>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted font-semibold">Ciphertext Handle:</span>
                          <HandleChip handle={balanceHandle as string} label="balance" />
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={performDecryption}
                            disabled={decrypting || !balanceHandle}
                            className="btn btn-ghost text-xs py-2 px-4 h-9 flex items-center gap-1.5"
                          >
                            <KeyIcon className="h-3.5 w-3.5 text-shell" />
                            <span>{decrypting ? "Decrypting..." : "Decrypt Balance"}</span>
                          </button>

                          {decryptedBalance !== null && (
                            <div className="flex items-baseline gap-1 py-1.5 px-3 bg-sea/10 border border-sea/30 rounded-full text-sea font-bold text-sm animate-fade-in">
                              <span>{Number(decryptedBalance).toLocaleString()}</span>
                              <span className="text-[10px] font-semibold text-sea/80">cUSDT</span>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-[11px] text-coral-soft">Connect your wallet to inspect your confidential balance.</p>
                    )}
                  </div>
                  <StatusLine status={decryptStatus.status} kind={decryptStatus.kind} />
                </div>
              </div>
            )}
          </div>
        )}

        <p>Built on ERC-7984 confidential tokens and FHEVM. Testnet only — no real value.</p>
      </div>
    </main>
  );
}

/** The demo beat as a teaser: an amount becoming an opaque ciphertext handle. */
function CipherTease() {
  return (
    <span className="chip group cursor-help transition-all duration-300 hover:border-sea/30" title="Amounts are encrypted client-side before they ever touch the chain">
      <span className="text-shell-dim font-semibold transition-colors group-hover:text-shell">5,000</span>
      <span className="text-muted group-hover:text-sea transition-colors" aria-hidden>
        →
      </span>
      <span className="handle transition-colors">0x9f3a…e21c</span>
    </span>
  );
}
