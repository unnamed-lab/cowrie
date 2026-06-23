"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { encryptAmount } from "@/fhe/useEncrypt";
import { CIRCLE_ABI, TOKEN_ABI, useCowrieAddresses, operatorUntil } from "@/lib/contracts";
import { ShellMeter } from "./ShellMeter";
import { ModeCard, AmountRow, StatusLine, useStatus } from "./ui";

/**
 * Circles — a rotating savings group (ROSCA / esusu). Everyone contributes an
 * encrypted amount each round; one member collects the whole pot. Amounts stay
 * private; only the rotation is public.
 */
export function Circles() {
  const { address } = useAccount();
  const { addresses, configured } = useCowrieAddresses();
  const { writeContractAsync, isPending } = useWriteContract();
  const [amount, setAmount] = useState("100");
  const s = useStatus();

  const circle = addresses?.SavingsCircle as `0x${string}` | undefined;
  const token = addresses?.ConfidentialUSDT as `0x${string}` | undefined;

  const { data: round } = useReadContract({
    abi: CIRCLE_ABI,
    address: circle,
    functionName: "round",
    query: { enabled: !!circle && configured },
  });
  const { data: filled } = useReadContract({
    abi: CIRCLE_ABI,
    address: circle,
    functionName: "contributionsThisRound",
    query: { enabled: !!circle && configured },
  });
  const { data: members } = useReadContract({
    abi: CIRCLE_ABI,
    address: circle,
    functionName: "memberCount",
    query: { enabled: !!circle && configured },
  });

  async function approve() {
    if (!token || !circle) return;
    try {
      s.working("Approving the circle to move your cUSDT…");
      await writeContractAsync({
        abi: TOKEN_ABI,
        address: token,
        functionName: "setOperator",
        args: [circle, operatorUntil()],
      });
      s.done("Circle approved.");
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  async function contribute() {
    if (!address || !circle) return;
    try {
      s.working("Encrypting your contribution…");
      const { handle, inputProof } = await encryptAmount(circle, address, BigInt(amount));
      s.working("Submitting — your amount stays encrypted on-chain…");
      await writeContractAsync({
        abi: CIRCLE_ABI,
        address: circle,
        functionName: "contribute",
        args: [handle, inputProof],
      });
      s.done("Contributed privately. Your amount never appears in clear.");
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  return (
    <ModeCard
      title="Circles"
      lede="A rotating savings group (ROSCA / Esusu / Chama / Stokvel). Everyone contributes; one member collects the pot each round. Amounts stay private."
      configured={configured}
    >
      <div className="mb-6 rounded-2xl bg-ink/60 p-5">
        <ShellMeter filled={Number(filled ?? 0)} total={Number(members ?? 0)} />
        <p className="mt-3 text-xs uppercase tracking-wider text-muted">Round {String(round ?? 0n)}</p>
      </div>
      <div className="flex flex-col gap-4">
        <button onClick={approve} className="btn btn-ghost self-start">
          Approve circle
        </button>
        <AmountRow value={amount} onChange={setAmount} onSubmit={contribute} cta="Contribute privately" busy={isPending} />
      </div>
      <StatusLine status={s.status} kind={s.kind} />
    </ModeCard>
  );
}
