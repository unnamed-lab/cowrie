"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { encryptAmount } from "@/fhe/useEncrypt";
import { publicDecryptReached } from "@/fhe/usePublicDecrypt";
import {
  CROWDFUND_ABI,
  TOKEN_ABI,
  useCowrieAddresses,
  operatorUntil,
} from "@/lib/contracts";
import { CROWDFUND_STATE } from "@cowrie/shared";
import { ModeCard, AmountRow, StatusLine } from "./ui";

/**
 * Pools — confidential crowdfunding. Contributions accumulate encrypted; the only
 * thing ever revealed is a single boolean: did the encrypted total reach the
 * public goal? Individual contributions are never revealed.
 */
export function Pools() {
  const { address } = useAccount();
  const { addresses, configured } = useCowrieAddresses();
  const { writeContractAsync, isPending } = useWriteContract();

  const crowdfund = addresses?.Crowdfund as `0x${string}` | undefined;
  const token = addresses?.ConfidentialUSDT as `0x${string}` | undefined;

  const [amount, setAmount] = useState("250000");
  const [status, setStatus] = useState("");

  const { data: state } = useReadContract({
    abi: CROWDFUND_ABI,
    address: crowdfund,
    functionName: "state",
    query: { enabled: !!crowdfund && configured },
  });
  const { data: goal } = useReadContract({
    abi: CROWDFUND_ABI,
    address: crowdfund,
    functionName: "goal",
    query: { enabled: !!crowdfund && configured },
  });

  const stateName = state !== undefined ? CROWDFUND_STATE[Number(state)] : "—";

  async function approve() {
    if (!token || !crowdfund) return;
    setStatus("Approving campaign to move your cUSDT…");
    await writeContractAsync({
      abi: TOKEN_ABI,
      address: token,
      functionName: "setOperator",
      args: [crowdfund, operatorUntil()],
    });
    setStatus("Campaign approved.");
  }

  async function contribute() {
    if (!address || !crowdfund) return;
    try {
      setStatus("Encrypting your contribution…");
      const { handle, inputProof } = await encryptAmount(crowdfund, address, BigInt(amount));
      setStatus("Contributing privately…");
      await writeContractAsync({
        abi: CROWDFUND_ABI,
        address: crowdfund,
        functionName: "contribute",
        args: [handle, inputProof],
      });
      setStatus("Contributed. Your amount is hidden; only the goal/total comparison is ever revealed.");
    } catch (e) {
      setStatus(`Failed: ${(e as Error).message}`);
    }
  }

  async function finalize() {
    if (!crowdfund) return;
    try {
      setStatus("Finalizing — computing goal-reached on the encrypted total…");
      await writeContractAsync({ abi: CROWDFUND_ABI, address: crowdfund, functionName: "finalize", args: [] });
      setStatus("Finalized. Now reveal & settle the goal boolean.");
    } catch (e) {
      setStatus(`Failed: ${(e as Error).message}`);
    }
  }

  /** Read the published handle, publicly decrypt it, and submit the proof on-chain. */
  async function revealAndSettle() {
    if (!crowdfund) return;
    try {
      setStatus("Fetching the encrypted goal-reached handle…");
      const handle = (await readReached(crowdfund)) as string;
      setStatus("Publicly decrypting (KMS) the single boolean…");
      const { reached, cleartexts, decryptionProof } = await publicDecryptReached(handle);
      setStatus(`Goal reached: ${reached}. Submitting proof on-chain…`);
      await writeContractAsync({
        abi: CROWDFUND_ABI,
        address: crowdfund,
        functionName: "settle",
        args: [cleartexts, decryptionProof],
      });
      setStatus(`Settled — campaign ${reached ? "Succeeded" : "Failed"}.`);
    } catch (e) {
      setStatus(`Failed: ${(e as Error).message}`);
    }
  }

  // Inline read via wagmi's core would need a client; we read through a fresh hook call.
  const { refetch: refetchReached } = useReadContract({
    abi: CROWDFUND_ABI,
    address: crowdfund,
    functionName: "reachedHandle",
    query: { enabled: false },
  });
  async function readReached(_addr: string) {
    const r = await refetchReached();
    return r.data;
  }

  return (
    <ModeCard
      title="Pools"
      lede="Confidential crowdfunding. Contributions stay encrypted; only a single boolean — goal reached or not — is ever revealed."
      configured={configured}
    >
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <span className="rounded-full px-3 py-1 text-sm" style={{ background: "var(--color-ink)", color: "var(--color-gold)" }}>
          State: {stateName}
        </span>
        <span className="text-sm" style={{ color: "var(--color-muted)" }}>
          Goal: {String(goal ?? 0n)} cUSDT
        </span>
      </div>
      <button
        onClick={approve}
        className="mb-4 rounded-full border px-4 py-2 text-sm"
        style={{ borderColor: "var(--color-muted)", color: "var(--color-shell)" }}
      >
        Approve campaign
      </button>
      <AmountRow value={amount} onChange={setAmount} onSubmit={contribute} cta="Contribute privately" busy={isPending} />

      <div className="mt-5 flex flex-wrap gap-3">
        <button onClick={finalize} className="rounded-full border px-4 py-2 text-sm" style={{ borderColor: "var(--color-muted)", color: "var(--color-shell)" }}>
          Finalize (after deadline)
        </button>
        <button onClick={revealAndSettle} className="rounded-full border px-4 py-2 text-sm" style={{ borderColor: "var(--color-muted)", color: "var(--color-shell)" }}>
          Reveal &amp; settle
        </button>
        <button
          onClick={() => crowdfund && writeContractAsync({ abi: CROWDFUND_ABI, address: crowdfund, functionName: "release", args: [] })}
          className="rounded-full border px-4 py-2 text-sm"
          style={{ borderColor: "var(--color-muted)", color: "var(--color-shell)" }}
        >
          Release (if succeeded)
        </button>
        <button
          onClick={() => crowdfund && writeContractAsync({ abi: CROWDFUND_ABI, address: crowdfund, functionName: "refund", args: [] })}
          className="rounded-full border px-4 py-2 text-sm"
          style={{ borderColor: "var(--color-muted)", color: "var(--color-shell)" }}
        >
          Refund (if failed)
        </button>
      </div>
      <StatusLine status={status} />
    </ModeCard>
  );
}
