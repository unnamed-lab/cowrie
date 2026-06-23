"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { encryptAmount } from "@/fhe/useEncrypt";
import { CIRCLE_ABI, FACTORY_ABI, TOKEN_ABI, useCowrieAddresses, operatorUntil } from "@/lib/contracts";
import { ShellMeter } from "./ShellMeter";
import { ModeCard, AmountRow, StatusLine, useStatus } from "./ui";

/**
 * CircleChip renders an individual circle address in the list,
 * fetching its name from the contract asynchronously.
 */
function CircleChip({
  address,
  isActive,
  onClick,
}: {
  address: `0x${string}`;
  isActive: boolean;
  onClick: () => void;
}) {
  const { data: name } = useReadContract({
    abi: CIRCLE_ABI,
    address,
    functionName: "name",
  });

  const displayName = name ? (name as string) : `Circle (${address.slice(0, 6)}…)`;

  return (
    <button
      onClick={onClick}
      type="button"
      className={`chip text-xs font-semibold py-2 px-3 transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
        isActive
          ? "border-gold bg-gold/15 text-gold shadow-md shadow-gold/5 scale-105"
          : "border-shell/10 bg-ink/40 text-shell-dim hover:border-gold/30 hover:bg-gold/5"
      }`}
    >
      <span className="font-sans">{displayName}</span>
      <span className="text-[9px] opacity-60 font-mono">
        {address.slice(0, 6)}…{address.slice(-4)}
      </span>
    </button>
  );
}

/**
 * Circles — a multi-circle rotating savings group dashboard (ROSCA / Esusu / Chama).
 * Allows users to list their active circles, switch between them, load custom circle addresses,
 * and create new ones dynamically on-chain.
 */
export function Circles() {
  const { address, isConnected } = useAccount();
  const { addresses, configured } = useCowrieAddresses();
  const { writeContractAsync, isPending } = useWriteContract();
  const s = useStatus();

  // Selected circle state
  const defaultCircleAddr = addresses?.SavingsCircle as `0x${string}` | undefined;
  const [selectedCircleAddress, setSelectedCircleAddress] = useState<string | undefined>(undefined);
  const activeCircleAddress = (selectedCircleAddress || defaultCircleAddr) as `0x${string}` | undefined;

  // Custom load and creation state
  const [customAddressInput, setCustomAddressInput] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [circleName, setCircleName] = useState("");
  const [initialMembersInput, setInitialMembersInput] = useState("");

  // Main contribution inputs
  const [amount, setAmount] = useState("100");
  const [newMember, setNewMember] = useState("");

  const token = addresses?.ConfidentialUSDT as `0x${string}` | undefined;

  // Read list of user circles from the Factory registry
  const { data: userCirclesData, refetch: refetchUserCircles } = useReadContract({
    abi: FACTORY_ABI,
    address: addresses?.SavingsCircleFactory as `0x${string}` | undefined,
    functionName: "getUserCircles",
    args: address ? [address] : undefined,
    query: { enabled: !!addresses?.SavingsCircleFactory && !!address && configured },
  });

  // Extract unique circle addresses
  const userCircles = (userCirclesData as `0x${string}`[]) || [];
  const allUserCircles = Array.from(
    new Set(
      [defaultCircleAddr, ...userCircles].filter(
        (addr): addr is `0x${string}` => !!addr && addr !== "0x0000000000000000000000000000000000000000"
      )
    )
  );

  // Read active circle state details
  const { data: activeCircleName, refetch: refetchName } = useReadContract({
    abi: CIRCLE_ABI,
    address: activeCircleAddress,
    functionName: "name",
    query: { enabled: !!activeCircleAddress && configured },
  });
  const { data: round, refetch: refetchRound } = useReadContract({
    abi: CIRCLE_ABI,
    address: activeCircleAddress,
    functionName: "round",
    query: { enabled: !!activeCircleAddress && configured },
  });
  const { data: filled, refetch: refetchFilled } = useReadContract({
    abi: CIRCLE_ABI,
    address: activeCircleAddress,
    functionName: "contributionsThisRound",
    query: { enabled: !!activeCircleAddress && configured },
  });
  const { data: members, refetch: refetchMembers } = useReadContract({
    abi: CIRCLE_ABI,
    address: activeCircleAddress,
    functionName: "getMembers",
    query: { enabled: !!activeCircleAddress && configured },
  });
  const { data: isMember, refetch: refetchIsMember } = useReadContract({
    abi: CIRCLE_ABI,
    address: activeCircleAddress,
    functionName: "isMember",
    args: address ? [address] : undefined,
    query: { enabled: !!activeCircleAddress && !!address && configured },
  });
  const { data: isAuthorized, refetch: refetchIsAuthorized } = useReadContract({
    abi: CIRCLE_ABI,
    address: activeCircleAddress,
    functionName: "isAuthorized",
    args: address ? [address] : undefined,
    query: { enabled: !!activeCircleAddress && !!address && configured },
  });
  const { data: organizer, refetch: refetchOrganizer } = useReadContract({
    abi: CIRCLE_ABI,
    address: activeCircleAddress,
    functionName: "organizer",
    query: { enabled: !!activeCircleAddress && configured },
  });

  const isCurrentOrganizer = address && organizer && address.toLowerCase() === (organizer as string).toLowerCase();
  const showRegistration = round === 0n && Number(filled ?? 0) === 0;

  // Recipient details for current round
  const nextRecipient = members && round !== undefined && members.length > 0
    ? members[Number(round) % members.length]
    : undefined;
  const isCurrentUserRecipient = address && nextRecipient && address.toLowerCase() === nextRecipient.toLowerCase();

  // Helper to trigger UI refetches
  const refetchAll = () => {
    refetchName();
    refetchRound();
    refetchFilled();
    refetchMembers();
    refetchIsMember();
    refetchIsAuthorized();
    refetchOrganizer();
    refetchUserCircles();
  };

  // Actions
  async function approve() {
    if (!token || !activeCircleAddress) return;
    try {
      s.working("Approving the circle to move your cUSDT…");
      await writeContractAsync({
        abi: TOKEN_ABI,
        address: token,
        functionName: "setOperator",
        args: [activeCircleAddress, operatorUntil()],
      });
      s.done("Circle approved successfully.");
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  async function contribute() {
    if (!address || !activeCircleAddress) return;
    try {
      s.working("Encrypting your contribution amount…");
      const { handle, inputProof } = await encryptAmount(activeCircleAddress, address, BigInt(amount));
      s.working("Submitting — your amount stays encrypted on-chain…");
      await writeContractAsync({
        abi: CIRCLE_ABI,
        address: activeCircleAddress,
        functionName: "contribute",
        args: [handle, inputProof],
      });
      s.done("Contributed privately. Your amount never appears in clear.");
      refetchAll();
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  async function joinCircle() {
    if (!activeCircleAddress) return;
    try {
      s.working("Joining the savings circle...");
      await writeContractAsync({
        abi: CIRCLE_ABI,
        address: activeCircleAddress,
        functionName: "join",
        args: [],
      });
      s.done("Successfully joined the savings circle!");
      refetchAll();
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  async function authorize() {
    if (!activeCircleAddress || !newMember) return;
    try {
      s.working(`Authorizing address ${newMember.slice(0, 6)}...`);
      await writeContractAsync({
        abi: CIRCLE_ABI,
        address: activeCircleAddress,
        functionName: "authorizeMember",
        args: [newMember as `0x${string}`],
      });
      s.done(`Authorized ${newMember} to join!`);
      setNewMember("");
      refetchAll();
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  async function triggerPayout() {
    if (!activeCircleAddress) return;
    try {
      s.working("Executing pot payout and rotating round...");
      await writeContractAsync({
        abi: CIRCLE_ABI,
        address: activeCircleAddress,
        functionName: "payout",
        args: [],
      });
      s.done("Payout processed. The pot has rotated to the next recipient!");
      refetchAll();
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  // Load custom circle address
  function loadCustomAddress() {
    if (!customAddressInput.startsWith("0x") || customAddressInput.length !== 42) {
      s.error("Invalid Ethereum address format.");
      return;
    }
    setSelectedCircleAddress(customAddressInput);
    setCustomAddressInput("");
    s.done(`Loaded circle at ${customAddressInput}`);
  }

  // Create new circle via factory
  async function handleCreateCircle() {
    if (!token || !addresses?.SavingsCircleFactory) return;
    try {
      s.working("Deploying new savings circle to Sepolia…");
      const parsedMembers = initialMembersInput
        .split(",")
        .map((x) => x.trim())
        .filter((x) => x.startsWith("0x") && x.length === 42) as `0x${string}`[];

      // Ensure organizer is included
      if (address && !parsedMembers.some((m) => m.toLowerCase() === address.toLowerCase())) {
        parsedMembers.unshift(address as `0x${string}`);
      }

      if (parsedMembers.length === 0) {
        throw new Error("Must specify at least one member address.");
      }

      await writeContractAsync({
        abi: FACTORY_ABI,
        address: addresses.SavingsCircleFactory as `0x${string}`,
        functionName: "createCircle",
        args: [token, circleName || "My Esusu", parsedMembers],
      });

      s.done("New savings circle deployed! Whitelisted members can now join.");
      setCircleName("");
      setInitialMembersInput("");
      setShowCreateForm(false);
      refetchUserCircles();
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  const activeCircleNameStr = activeCircleName ? (activeCircleName as string) : "Savings Circle";
  const memberCount = members ? members.length : 0;
  const isRoundComplete = filled !== undefined && memberCount > 0 && Number(filled) === memberCount;

  return (
    <ModeCard
      title="Circles"
      lede="A rotating savings group (ROSCA / Esusu / Chama / Stokvel). Everyone contributes; one member collects the pot each round. Amounts stay private."
      configured={configured}
    >
      {/* Circle selector and creation manager */}
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-gold">Select Circle</span>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn btn-ghost text-xs py-1 px-3 h-8"
            type="button"
          >
            {showCreateForm ? "Back to Dashboard" : "Create Circle"}
          </button>
        </div>

        {showCreateForm ? (
          <div className="rounded-2xl border border-gold/15 bg-ink/40 p-5 flex flex-col gap-4 animate-fade-in">
            <h3 className="text-sm font-bold text-gold uppercase tracking-wider">Start a New Savings Circle</h3>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-muted tracking-wider uppercase">Circle Name</label>
              <input
                value={circleName}
                onChange={(e) => setCircleName(e.target.value)}
                placeholder="e.g. Kigali Esusu, Nairobi Chama"
                className="field text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-muted tracking-wider uppercase">
                Initial Whitelisted Members (comma-separated 0x addresses)
              </label>
              <textarea
                value={initialMembersInput}
                onChange={(e) => setInitialMembersInput(e.target.value)}
                placeholder="0x123..., 0xabc..."
                rows={3}
                className="field font-mono text-xs w-full py-2 resize-none"
              />
              <p className="text-[10px] text-muted leading-relaxed">
                Organizer (you) is included automatically. Initial members will be whitelisted and pre-authorized to join.
              </p>
            </div>

            <button
              onClick={handleCreateCircle}
              disabled={isPending}
              className="btn btn-primary self-start text-xs py-2 px-5"
              type="button"
            >
              Deploy Circle Contract
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Active circle list chips */}
            <div className="flex flex-wrap gap-2.5">
              {allUserCircles.map((addr) => (
                <CircleChip
                  key={addr}
                  address={addr}
                  isActive={activeCircleAddress === addr}
                  onClick={() => setSelectedCircleAddress(addr)}
                />
              ))}
            </div>

            {/* Custom address loader */}
            <div className="flex gap-2 max-w-md items-center">
              <input
                value={customAddressInput}
                onChange={(e) => setCustomAddressInput(e.target.value)}
                placeholder="Load circle address 0x…"
                className="field font-mono text-xs flex-1 py-1 px-3 h-8"
              />
              <button
                onClick={loadCustomAddress}
                className="btn btn-ghost text-xs py-1 px-3 h-8"
                type="button"
              >
                Load
              </button>
            </div>
          </div>
        )}
      </div>

      {!showCreateForm && activeCircleAddress && (
        <div className="animate-fade-in">
          {/* Active Circle Panel details */}
          <div className="mb-6 rounded-2xl bg-ink/60 p-5 relative overflow-hidden border border-shell/5">
            <div className="flex justify-between items-start mb-1 flex-wrap gap-2">
              <h3 className="text-base font-bold text-shell">{activeCircleNameStr}</h3>
              <span className="font-mono text-[10px] bg-ink/80 text-muted px-2 py-0.5 rounded-full border border-shell/5">
                {activeCircleAddress}
              </span>
            </div>
            
            <p className="text-xs text-muted mb-4">
              Organizer: <span className="font-mono">{organizer ? `${(organizer as string).slice(0, 6)}…${(organizer as string).slice(-4)}` : "—"}</span>
            </p>

            <ShellMeter filled={Number(filled ?? 0)} total={memberCount} />
            <p className="mt-3 text-xs uppercase tracking-wider text-muted font-semibold">
              Round {String(round ?? 0n)} &bull; {Number(filled ?? 0)}/{memberCount} Contributions
            </p>

            {nextRecipient && (
              <div className="mt-4 p-3 rounded-xl bg-gold/5 border border-gold/10 flex items-center justify-between gap-3 text-xs">
                <span className="text-muted font-medium">Round Recipient:</span>
                <span className={`font-semibold ${isCurrentUserRecipient ? "text-gold" : "text-shell"}`}>
                  <span className="font-mono">
                    {nextRecipient.slice(0, 6)}…{nextRecipient.slice(-4)}
                  </span>
                  {isCurrentUserRecipient && " (You!)"}
                </span>
              </div>
            )}

            {/* Member list section */}
            {members && members.length > 0 && (
              <div className="mt-5 border-t border-shell/5 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gold mb-2">Members ({members.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {members.map((m: string) => {
                    const isCurrentUser = address && m.toLowerCase() === address.toLowerCase();
                    const isOrg = organizer && m.toLowerCase() === (organizer as string).toLowerCase();
                    const isRecipient = nextRecipient && m.toLowerCase() === nextRecipient.toLowerCase();
                    return (
                      <span
                        key={m}
                        className={`chip text-xs flex items-center gap-1.5 ${
                          isCurrentUser ? "border-gold/30 bg-gold/5" : ""
                        } ${isRecipient ? "border-sea/30" : ""}`}
                      >
                        <span className="font-mono">{m.slice(0, 6)}…{m.slice(-4)}</span>
                        {isOrg && (
                          <span className="text-[8px] bg-gold/20 text-gold px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            Organizer
                          </span>
                        )}
                        {isCurrentUser && (
                          <span className="text-[8px] bg-sea/20 text-sea px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            You
                          </span>
                        )}
                        {isRecipient && (
                          <span className="text-[8px] bg-gold/10 text-gold-dim px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            Recipient
                          </span>
                        )}
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
                  <button onClick={joinCircle} className="btn btn-primary text-xs py-2 px-4 h-9" type="button">
                    Join Circle
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-coral/5 border border-coral/15">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-coral-soft mb-1">Not Member</h4>
                  <p className="text-[11px] text-muted font-medium">
                    You are not a member of this circle. The organizer must authorize your address to join.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Main actions area (only visible to members) */}
          {isMember && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={approve} className="btn btn-ghost text-xs py-1.5 px-3.5" type="button">
                  Approve Operator
                </button>
                
                {isRoundComplete && (
                  <button
                    onClick={triggerPayout}
                    disabled={isPending}
                    className="btn btn-primary text-xs py-1.5 px-3.5 bg-sea hover:bg-sea/80"
                    type="button"
                  >
                    Payout Round Pot
                  </button>
                )}
              </div>

              <AmountRow
                value={amount}
                onChange={setAmount}
                onSubmit={contribute}
                cta="Contribute privately"
                busy={isPending}
              />
            </div>
          )}

          {/* Organizer control panel */}
          {isCurrentOrganizer && showRegistration && (
            <div className="mt-6 border-t border-shell/5 pt-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gold mb-1">
                Organizer Panel — Authorize Member
              </h4>
              <p className="text-[11px] text-muted mb-3 font-medium">
                Whitelist a address below so they can join this savings circle.
              </p>
              <div className="flex gap-2 max-w-lg">
                <input
                  value={newMember}
                  onChange={(e) => setNewMember(e.target.value)}
                  placeholder="0x…"
                  className="field flex-1 font-mono text-sm py-2"
                />
                <button onClick={authorize} className="btn btn-ghost text-xs py-2 px-4" type="button">
                  Authorize
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <StatusLine status={s.status} kind={s.kind} />
    </ModeCard>
  );
}
