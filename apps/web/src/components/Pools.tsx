"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { encryptAmount } from "@/fhe/useEncrypt";
import { publicDecryptReached } from "@/fhe/usePublicDecrypt";
import { CROWDFUND_ABI, TOKEN_ABI, useCowrieAddresses, operatorUntil } from "@/lib/contracts";
import { CROWDFUND_STATE } from "@cowrie/shared";
import { ModeCard, AmountRow, StatusLine, useStatus } from "./ui";

const STATE_TONE: Record<string, string> = {
  Active: "text-sea",
  Deciding: "text-gold",
  Succeeded: "text-sea",
  Failed: "text-coral-soft",
};

/**
 * Pools — confidential crowdfunding. Contributions accumulate encrypted; the only
 * thing ever revealed is a single boolean: did the encrypted total reach the
 * public goal? Individual contributions are never revealed.
 */
export function Pools() {
  const { address } = useAccount();
  const { addresses, configured } = useCowrieAddresses();
  const { writeContractAsync, isPending } = useWriteContract();
  const s = useStatus();

  const crowdfund = addresses?.Crowdfund as `0x${string}` | undefined;
  const token = addresses?.ConfidentialUSDT as `0x${string}` | undefined;

  const [amount, setAmount] = useState("250000");

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
  const { refetch: refetchReached } = useReadContract({
    abi: CROWDFUND_ABI,
    address: crowdfund,
    functionName: "reachedHandle",
    query: { enabled: false },
  });

  const stateName = state !== undefined ? CROWDFUND_STATE[Number(state)] : "—";

  async function approve() {
    if (!token || !crowdfund) return;
    try {
      s.working("Approving the campaign to move your cUSDT…");
      await writeContractAsync({
        abi: TOKEN_ABI,
        address: token,
        functionName: "setOperator",
        args: [crowdfund, operatorUntil()],
      });
      s.done("Campaign approved.");
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  async function contribute() {
    if (!address || !crowdfund) return;
    try {
      s.working("Encrypting your contribution…");
      const { handle, inputProof } = await encryptAmount(crowdfund, address, BigInt(amount));
      s.working("Contributing privately…");
      await writeContractAsync({
        abi: CROWDFUND_ABI,
        address: crowdfund,
        functionName: "contribute",
        args: [handle, inputProof],
      });
      s.done("Contributed. Only the goal/total comparison is ever revealed — never your amount.");
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  async function finalize() {
    if (!crowdfund) return;
    try {
      s.working("Finalizing — comparing the encrypted total against the goal…");
      await writeContractAsync({ abi: CROWDFUND_ABI, address: crowdfund, functionName: "finalize", args: [] });
      s.done("Finalized. Now reveal & settle the goal boolean.");
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  /** Read the published handle, publicly decrypt it, submit the KMS proof on-chain. */
  async function revealAndSettle() {
    if (!crowdfund) return;
    try {
      s.working("Fetching the encrypted goal-reached handle…");
      const { data: handle } = await refetchReached();
      if (!handle) throw new Error("No handle yet — finalize first.");
      s.working("Publicly decrypting the single boolean (KMS)…");
      const { reached, cleartexts, decryptionProof } = await publicDecryptReached(handle as string);
      s.working(`Goal reached: ${reached}. Submitting the proof on-chain…`);
      await writeContractAsync({
        abi: CROWDFUND_ABI,
        address: crowdfund,
        functionName: "settle",
        args: [cleartexts, decryptionProof],
      });
      s.done(`Settled — campaign ${reached ? "Succeeded" : "Failed"}.`);
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  function action(fn: "release" | "refund") {
    if (!crowdfund) return;
    writeContractAsync({ abi: CROWDFUND_ABI, address: crowdfund, functionName: fn, args: [] })
      .then(() => s.done(fn === "release" ? "Released to the beneficiary." : "Refund sent."))
      .catch((e) => s.error((e as Error).message));
  }

  return (
    <ModeCard
      title="Pools"
      lede="Confidential crowdfunding. Contributions stay encrypted; only a single boolean — goal reached or not — is ever revealed."
      configured={configured}
      badge={
        <span className={`chip ${STATE_TONE[stateName] ?? ""}`}>
          <span className="h-2 w-2 rounded-full bg-current" aria-hidden /> {stateName}
        </span>
      }
    >
      <div className="mb-6 flex items-baseline gap-2 rounded-2xl bg-ink/60 px-5 py-4">
        <span className="text-xs uppercase tracking-wider text-muted">Public goal</span>
        <span className="font-display text-2xl text-gold">{Number(goal ?? 0n).toLocaleString()}</span>
        <span className="text-sm text-muted">cUSDT</span>
      </div>

      <div className="flex flex-col gap-4">
        <button onClick={approve} className="btn btn-ghost self-start">
          Approve campaign
        </button>
        <AmountRow value={amount} onChange={setAmount} onSubmit={contribute} cta="Contribute privately" busy={isPending} />
      </div>

      <div className="mt-6 border-t border-shell/10 pt-5">
        <p className="mb-3 text-xs uppercase tracking-wider text-muted">Lifecycle</p>
        <div className="flex flex-wrap gap-2.5">
          <button onClick={finalize} className="btn btn-ghost">
            Finalize
          </button>
          <button onClick={revealAndSettle} className="btn btn-ghost">
            Reveal &amp; settle
          </button>
          <button onClick={() => action("release")} className="btn btn-ghost">
            Release
          </button>
          <button onClick={() => action("refund")} className="btn btn-ghost">
            Refund
          </button>
        </div>
      </div>
      <StatusLine status={s.status} kind={s.kind} />
    </ModeCard>
  );
}
