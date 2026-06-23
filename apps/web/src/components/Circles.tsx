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
  const { address, isConnected } = useAccount();
  const { addresses, configured } = useCowrieAddresses();
  const { writeContractAsync, isPending } = useWriteContract();
  const [amount, setAmount] = useState("100");
  const [newMember, setNewMember] = useState("");
  const s = useStatus();

  const circle = addresses?.SavingsCircle as `0x${string}` | undefined;
  const token = addresses?.ConfidentialUSDT as `0x${string}` | undefined;

  // Read circle states
  const { data: round } = useReadContract({
    abi: CIRCLE_ABI,
    address: circle,
    functionName: "round",
    query: { enabled: !!circle && configured },
  });
  const { data: filled, refetch: refetchFilled } = useReadContract({
    abi: CIRCLE_ABI,
    address: circle,
    functionName: "contributionsThisRound",
    query: { enabled: !!circle && configured },
  });
  const { data: members, refetch: refetchMembers } = useReadContract({
    abi: CIRCLE_ABI,
    address: circle,
    functionName: "getMembers",
    query: { enabled: !!circle && configured },
  });
  const { data: isMember, refetch: refetchIsMember } = useReadContract({
    abi: CIRCLE_ABI,
    address: circle,
    functionName: "isMember",
    args: address ? [address] : undefined,
    query: { enabled: !!circle && !!address && configured },
  });
  const { data: isAuthorized, refetch: refetchIsAuthorized } = useReadContract({
    abi: CIRCLE_ABI,
    address: circle,
    functionName: "isAuthorized",
    args: address ? [address] : undefined,
    query: { enabled: !!circle && !!address && configured },
  });
  const { data: organizer } = useReadContract({
    abi: CIRCLE_ABI,
    address: circle,
    functionName: "organizer",
    query: { enabled: !!circle && configured },
  });

  const isCurrentOrganizer = address && organizer && address.toLowerCase() === (organizer as string).toLowerCase();
  const showRegistration = round === 0n && Number(filled ?? 0) === 0;

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
      refetchFilled();
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  async function joinCircle() {
    if (!circle) return;
    try {
      s.working("Joining the savings circle...");
      await writeContractAsync({
        abi: CIRCLE_ABI,
        address: circle,
        functionName: "join",
        args: [],
      });
      s.done("Successfully joined the savings circle!");
      refetchIsMember();
      refetchMembers();
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  async function authorize() {
    if (!circle || !newMember) return;
    try {
      s.working(`Authorizing address ${newMember.slice(0, 6)}...`);
      await writeContractAsync({
        abi: CIRCLE_ABI,
        address: circle,
        functionName: "authorizeMember",
        args: [newMember as `0x${string}`],
      });
      s.done(`Authorized ${newMember} to join!`);
      setNewMember("");
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
        <ShellMeter filled={Number(filled ?? 0)} total={members ? members.length : 0} />
        <p className="mt-3 text-xs uppercase tracking-wider text-muted">Round {String(round ?? 0n)}</p>

        {/* Member list section */}
        {members && members.length > 0 && (
          <div className="mt-5 border-t border-shell/5 pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gold mb-2">Members ({members.length})</h4>
            <div className="flex flex-wrap gap-2">
              {members.map((m: string) => {
                const isCurrentUser = address && m.toLowerCase() === address.toLowerCase();
                const isOrg = organizer && m.toLowerCase() === (organizer as string).toLowerCase();
                return (
                  <span key={m} className={`chip text-xs ${isCurrentUser ? "border-gold/30 bg-gold/5" : ""}`}>
                    <span className="font-mono">{m.slice(0, 6)}…{m.slice(-4)}</span>
                    {isOrg && <span className="text-[9px] bg-gold/20 text-gold px-1.5 py-0.5 rounded-full font-bold ml-1.5 uppercase tracking-wider">Organizer</span>}
                    {isCurrentUser && <span className="text-[9px] bg-sea/20 text-sea px-1.5 py-0.5 rounded-full font-bold ml-1.5 uppercase tracking-wider">You</span>}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {isConnected && !isMember && (
        <div className="mb-6">
          {isAuthorized ? (
            <div className="p-4 rounded-2xl bg-gold/5 border border-gold/15 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gold mb-1">Authorized to Join</h4>
                <p className="text-[11px] text-muted">The organizer has whitelisted you. Join now to participate in this circle.</p>
              </div>
              <button onClick={joinCircle} className="btn btn-primary text-xs py-2 px-4 h-9">
                Join Circle
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-coral/5 border border-coral/15">
              <h4 className="text-xs font-bold uppercase tracking-wider text-coral-soft mb-1">Not Member</h4>
              <p className="text-[11px] text-muted">You are not a member of this circle. The organizer must authorize your address to join.</p>
            </div>
          )}
        </div>
      )}

      {/* Main contribution area (only visible to members) */}
      {isMember && (
        <div className="flex flex-col gap-4">
          <button onClick={approve} className="btn btn-ghost self-start">
            Approve circle
          </button>
          <AmountRow value={amount} onChange={setAmount} onSubmit={contribute} cta="Contribute privately" busy={isPending} />
        </div>
      )}

      {/* Organizer control panel */}
      {isCurrentOrganizer && showRegistration && (
        <div className="mt-6 border-t border-shell/5 pt-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gold mb-1">Organizer Panel — Authorize Member</h4>
          <p className="text-[11px] text-muted mb-3">Whitelist an address below so they can join the savings circle.</p>
          <div className="flex gap-2 max-w-lg">
            <input
              value={newMember}
              onChange={(e) => setNewMember(e.target.value)}
              placeholder="0x…"
              className="field flex-1 font-mono text-sm py-2"
            />
            <button onClick={authorize} className="btn btn-ghost text-xs py-2 px-4">
              Authorize
            </button>
          </div>
        </div>
      )}

      <StatusLine status={s.status} kind={s.kind} />
    </ModeCard>
  );
}
