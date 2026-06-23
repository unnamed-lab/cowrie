"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { encryptAmount } from "@/fhe/useEncrypt";
import { CIRCLE_ABI, TOKEN_ABI, useCowrieAddresses, operatorUntil } from "@/lib/contracts";
import { ShellMeter } from "./ShellMeter";
import { ModeCard, AmountRow, StatusLine } from "./ui";

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
  const [status, setStatus] = useState("");

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
    setStatus("Approving circle to move your cUSDT…");
    await writeContractAsync({
      abi: TOKEN_ABI,
      address: token,
      functionName: "setOperator",
      args: [circle, operatorUntil()],
    });
    setStatus("Circle approved.");
  }

  async function contribute() {
    if (!address || !circle) return;
    try {
      setStatus("Encrypting your contribution…");
      const { handle, inputProof } = await encryptAmount(circle, address, BigInt(amount));
      setStatus("Submitting (amount stays encrypted on-chain)…");
      await writeContractAsync({
        abi: CIRCLE_ABI,
        address: circle,
        functionName: "contribute",
        args: [handle, inputProof],
      });
      setStatus("Contributed privately. Your amount never appears in clear.");
    } catch (e) {
      setStatus(`Failed: ${(e as Error).message}`);
    }
  }

  return (
    <ModeCard
      title="Circles"
      lede="A rotating savings group. Everyone contributes; one member collects each round. Amounts stay private."
      configured={configured}
    >
      <div className="mb-5">
        <ShellMeter filled={Number(filled ?? 0)} total={Number(members ?? 0)} />
        <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
          Round {String(round ?? 0n)}
        </p>
      </div>
      <button
        onClick={approve}
        className="mb-4 rounded-full border px-4 py-2 text-sm"
        style={{ borderColor: "var(--color-muted)", color: "var(--color-shell)" }}
      >
        Approve circle
      </button>
      <AmountRow
        value={amount}
        onChange={setAmount}
        onSubmit={contribute}
        cta="Contribute privately"
        busy={isPending}
      />
      <StatusLine status={status} />
    </ModeCard>
  );
}
