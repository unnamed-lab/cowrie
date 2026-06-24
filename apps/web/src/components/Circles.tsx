"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useSignTypedData } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { encryptAmount } from "@/fhe/useEncrypt";
import { decryptHandle } from "@/fhe/useUserDecrypt";
import { CIRCLE_ABI, FACTORY_ABI, TOKEN_ABI, useCowrieAddresses, operatorUntil } from "@/lib/contracts";
import { useDeepLink, copyShareLink } from "@/lib/deeplink";
import { publicDecryptUint } from "@/fhe/usePublicDecrypt";
import { ShellMeter } from "./ShellMeter";
import { ModeCard, AmountRow, StatusLine, useStatus, Spinner } from "./ui";

const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

function CircleChip({
  address,
  isActive,
  isDissolved,
  onClick,
}: {
  address: `0x${string}`;
  isActive: boolean;
  isDissolved?: boolean;
  onClick: () => void;
}) {
  const { data: name } = useReadContract({ abi: CIRCLE_ABI, address, functionName: "name" });
  return (
    <button
      onClick={onClick}
      type="button"
      className={`chip text-xs font-semibold py-2 px-3 transition-all cursor-pointer flex items-center gap-1.5 ${
        isActive
          ? isDissolved
            ? "border-muted bg-surface text-muted shadow-inner"
            : "border-gold bg-gold/15 text-gold"
          : isDissolved
            ? "border-shell/5 bg-ink/20 text-muted opacity-60 hover:opacity-100 hover:border-muted/30"
            : "border-shell/10 bg-ink/40 text-shell-dim hover:border-gold/30"
      }`}
    >
      <span className="font-sans">{name ? (name as string) : "Circle"}{isDissolved ? " (Dissolved)" : ""}</span>
      <span className="text-[9px] opacity-60 font-mono">{short(address)}</span>
    </button>
  );
}

/**
 * Circles — multi-circle rotating savings (ROSCA / Esusu / Chama / Stokvel).
 * Circles you created or joined auto-list from the factory; you can also open a
 * shared link or paste an address. Everyone pays one organizer-set fixed amount;
 * the organizer can open a refund window for members to reclaim a round.
 */
export function Circles() {
  const { address, isConnected } = useAccount();
  const { addresses, configured } = useCowrieAddresses();
  const queryClient = useQueryClient();
  // Refresh all on-chain reads after any mutation settles (success OR failure).
  const { writeContractAsync, isPending } = useWriteContract({
    mutation: { onSettled: () => queryClient.invalidateQueries({ queryKey: ["readContract"] }) },
  });
  const { signTypedDataAsync } = useSignTypedData();
  const s = useStatus();

  const token = addresses?.ConfidentialUSDT as `0x${string}` | undefined;
  const factory = addresses?.SavingsCircleFactory as `0x${string}` | undefined;

  // No hardcoded default instance: the active circle comes from a deep link, a
  // manual load, or the first circle you belong to.
  const deepLinked = useDeepLink("circle");
  const [selected, setSelected] = useState<`0x${string}` | undefined>(undefined);
  const active = selected;

  const [customInput, setCustomInput] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [circleName, setCircleName] = useState("");
  const [membersInput, setMembersInput] = useState("");
  const [amountInput, setAmountInput] = useState("100");
  const [newMember, setNewMember] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);

  const [isApproving, setIsApproving] = useState(false);
  const [isDissolving, setIsDissolving] = useState(false);
  const [isVotingDissolve, setIsVotingDissolve] = useState(false);
  const [isRevealingPot, setIsRevealingPot] = useState(false);
  const [isSettingAmount, setIsSettingAmount] = useState(false);
  const [isContributing, setIsContributing] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isWhitelisting, setIsWhitelisting] = useState(false);
  const [isPayingOut, setIsPayingOut] = useState(false);
  const [isOpeningRefund, setIsOpeningRefund] = useState(false);
  const [isClosingRefund, setIsClosingRefund] = useState(false);
  const [isClaimingRefund, setIsClaimingRefund] = useState(false);
  const [isRevealingAmount, setIsRevealingAmount] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Circles you belong to (created or joined), from the factory registry.
  const { data: userCirclesData, refetch: refetchList } = useReadContract({
    abi: FACTORY_ABI,
    address: factory,
    functionName: "getUserCircles",
    args: address ? [address] : undefined,
    query: { enabled: !!factory && !!address && configured },
  });
  const userCircles = ((userCirclesData as `0x${string}`[]) || []).filter(
    (a) => a !== "0x0000000000000000000000000000000000000000",
  );

  const { data: dissolvedList } = useReadContracts({
    contracts: userCircles.map((addr) => ({
      abi: CIRCLE_ABI,
      address: addr,
      functionName: "dissolved",
    })),
    query: { enabled: userCircles.length > 0 },
  });

  const activeCircles: `0x${string}`[] = [];
  const dissolvedCircles: `0x${string}`[] = [];

  userCircles.forEach((addr, idx) => {
    const isDiss = dissolvedList?.[idx]?.result as boolean | undefined;
    if (isDiss) {
      dissolvedCircles.push(addr);
    } else {
      activeCircles.push(addr);
    }
  });

  // Auto-select: deep link wins, else the first circle you belong to.
  useEffect(() => {
    if (deepLinked) setSelected(deepLinked);
  }, [deepLinked]);
  useEffect(() => {
    if (!selected && activeCircles.length > 0) setSelected(activeCircles[0]);
    else if (!selected && dissolvedCircles.length > 0) setSelected(dissolvedCircles[0]);
  }, [selected, activeCircles, dissolvedCircles]);

  const on = !!active && configured;
  const onMe = on && !!address;
  const base = { abi: CIRCLE_ABI, address: active } as const;

  const { data: name } = useReadContract({ ...base, functionName: "name", query: { enabled: on } });
  const { data: round } = useReadContract({ ...base, functionName: "round", query: { enabled: on } });
  const { data: filled } = useReadContract({ ...base, functionName: "contributionsThisRound", query: { enabled: on } });
  const { data: members } = useReadContract({ ...base, functionName: "getMembers", query: { enabled: on } });
  const { data: organizer } = useReadContract({ ...base, functionName: "organizer", query: { enabled: on } });
  const { data: amountSet } = useReadContract({ ...base, functionName: "amountSet", query: { enabled: on } });
  const { data: refundOpen } = useReadContract({ ...base, functionName: "refundOpen", query: { enabled: on } });
  const { data: isMember } = useReadContract({
    ...base,
    functionName: "isMember",
    args: address ? [address] : undefined,
    query: { enabled: onMe },
  });
  const { data: isAuthorized } = useReadContract({
    ...base,
    functionName: "isAuthorized",
    args: address ? [address] : undefined,
    query: { enabled: onMe },
  });
  const { data: hasContributed } = useReadContract({
    ...base,
    functionName: "contributed",
    args: round !== undefined && address ? [round as bigint, address] : undefined,
    query: { enabled: onMe && round !== undefined },
  });
  const { data: hasRefunded } = useReadContract({
    ...base,
    functionName: "refunded",
    args: round !== undefined && address ? [round as bigint, address] : undefined,
    query: { enabled: onMe && round !== undefined },
  });
  const { data: dissolved } = useReadContract({ ...base, functionName: "dissolved", query: { enabled: on } });
  const { data: potHandle } = useReadContract({ ...base, functionName: "potTotalHandle", query: { enabled: on } });
  const { data: isApproved, refetch: refetchApproved } = useReadContract({
    abi: TOKEN_ABI,
    address: token,
    functionName: "isOperator",
    args: address && active ? [address, active] : undefined,
    query: { enabled: !!token && onMe },
  });

  const isOrganizer = !!address && !!organizer && address.toLowerCase() === (organizer as string).toLowerCase();
  const beforeStart = round === 0n && Number(filled ?? 0) === 0;
  const memberCount = members ? (members as string[]).length : 0;
  const roundComplete = filled !== undefined && memberCount > 0 && Number(filled) === memberCount;
  const canClaimRefund = !!refundOpen && !!hasContributed && !hasRefunded;

  async function tx(
    fn: () => Promise<unknown>,
    working: string,
    done: string,
    setLoading?: (loading: boolean) => void
  ) {
    try {
      if (setLoading) setLoading(true);
      s.working(working);
      await fn();
      s.done(done);
      setTimeout(() => {
        refetchList();
        refetchApproved();
      }, 1500);
    } catch (e) {
      s.error(e);
    } finally {
      if (setLoading) setLoading(false);
    }
  }

  const approve = () =>
    tx(
      () => writeContractAsync({ abi: TOKEN_ABI, address: token!, functionName: "setOperator", args: [active!, operatorUntil()] }),
      "Approving the circle to move your cUSDT…",
      "Circle approved — you can contribute now.",
      setIsApproving
    );

  const dissolve = () =>
    tx(() => writeContractAsync({ abi: CIRCLE_ABI, address: active!, functionName: "dissolve", args: [] }), "Dissolving the circle…", "Circle dissolved — refunds are open for everyone.", setIsDissolving);
  const approveDissolve = () =>
    tx(() => writeContractAsync({ abi: CIRCLE_ABI, address: active!, functionName: "approveDissolve", args: [] }), "Voting to dissolve…", "Vote recorded. When all members agree, the circle dissolves.", setIsVotingDissolve);

  const [pot, setPot] = useState<string | null>(null);
  async function revealPot() {
    if (!potHandle) return;
    try {
      setIsRevealingPot(true);
      s.working("Revealing the round pot total…");
      const v = await publicDecryptUint(potHandle as string);
      setPot(v.toString());
      s.done("Pot total revealed (individual contributions stay private).");
    } catch (e) {
      s.error(e);
    } finally {
      setIsRevealingPot(false);
    }
  }

  async function setFixedAmount() {
    if (!address || !active) return;
    try {
      setIsSettingAmount(true);
      s.working("Encrypting the fixed contribution amount…");
      const { handle, inputProof } = await encryptAmount(active, address, BigInt(amountInput));
      s.working("Setting the amount everyone will pay…");
      await writeContractAsync({ abi: CIRCLE_ABI, address: active, functionName: "setFixedAmount", args: [handle, inputProof] });
      s.done("Fixed amount set. Members can now contribute equally.");
    } catch (e) {
      s.error(e);
    } finally {
      setIsSettingAmount(false);
    }
  }

  const contribute = () =>
    tx(
      () => writeContractAsync({ abi: CIRCLE_ABI, address: active!, functionName: "contribute", args: [] }),
      "Contributing the fixed amount (stays encrypted)…",
      "Contributed privately.",
      setIsContributing
    );

  const join = () =>
    tx(() => writeContractAsync({ abi: CIRCLE_ABI, address: active!, functionName: "join", args: [] }), "Joining the circle…", "Joined.", setIsJoining);

  const authorize = () =>
    tx(
      () => writeContractAsync({ abi: CIRCLE_ABI, address: active!, functionName: "authorizeMember", args: [newMember as `0x${string}`] }),
      "Whitelisting member…",
      "Member authorized.",
      setIsWhitelisting
    ).then(() => setNewMember(""));

  const payout = () =>
    tx(() => writeContractAsync({ abi: CIRCLE_ABI, address: active!, functionName: "payout", args: [] }), "Paying out the pot…", "Pot rotated to the next recipient.", setIsPayingOut);

  const openRefund = () =>
    tx(() => writeContractAsync({ abi: CIRCLE_ABI, address: active!, functionName: "openRefund", args: [] }), "Opening the refund window…", "Refund window open — members can reclaim.", setIsOpeningRefund);
  const closeRefund = () =>
    tx(() => writeContractAsync({ abi: CIRCLE_ABI, address: active!, functionName: "closeRefund", args: [] }), "Closing the refund window…", "Refund window closed.", setIsClosingRefund);
  const claimRefund = () =>
    tx(() => writeContractAsync({ abi: CIRCLE_ABI, address: active!, functionName: "claimRefund", args: [] }), "Reclaiming your contribution…", "Refund sent back to you.", setIsClaimingRefund);

  async function revealAmount() {
    if (!active || !address) return;
    try {
      setIsRevealingAmount(true);
      s.working("Decrypting the fixed amount…");
      const handle = (await readFixedHandle()) as string;
      const signer = {
        address,
        signTypedData: (a: { domain: Record<string, unknown>; types: Record<string, unknown>; primaryType: string; message: Record<string, unknown> }) =>
          signTypedDataAsync(a as Parameters<typeof signTypedDataAsync>[0]),
      };
      const v = await decryptHandle(handle, active, signer);
      setRevealed(String(v));
      s.done("Decrypted locally — only members can read it.");
    } catch (e) {
      s.error(e);
    } finally {
      setIsRevealingAmount(false);
    }
  }
  const { refetch: refetchFixedHandle } = useReadContract({
    abi: CIRCLE_ABI,
    address: active,
    functionName: "fixedAmountHandle",
    query: { enabled: false },
  });
  async function readFixedHandle() {
    return (await refetchFixedHandle()).data;
  }

  async function createCircle() {
    if (!token || !factory || !address) return;
    try {
      setIsCreating(true);
      s.working("Deploying a new savings circle…");
      const parsed = membersInput
        .split(",")
        .map((x) => x.trim())
        .filter((x) => /^0x[0-9a-fA-F]{40}$/.test(x)) as `0x${string}`[];
      if (!parsed.some((m) => m.toLowerCase() === address.toLowerCase())) parsed.unshift(address as `0x${string}`);
      await writeContractAsync({ abi: FACTORY_ABI, address: factory, functionName: "createCircle", args: [token, circleName || "My Circle", parsed] });
      s.done("Circle deployed. Set the fixed amount, then members can join & contribute.");
      setCircleName("");
      setMembersInput("");
      setShowCreate(false);
      setTimeout(() => refetchList(), 2000);
    } catch (e) {
      s.error(e);
    } finally {
      setIsCreating(false);
    }
  }

  function loadCustom() {
    if (!/^0x[0-9a-fA-F]{40}$/.test(customInput)) return s.error("That doesn't look like a contract address.");
    setSelected(customInput as `0x${string}`);
    setRevealed(null);
    setCustomInput("");
    s.done(`Loaded ${short(customInput)}.`);
  }

  async function share() {
    if (!active) return;
    await copyShareLink("circle", active);
    s.done("Share link copied — opens this circle for whoever you send it to.");
  }

  return (
    <ModeCard
      title="Circles"
      lede="A rotating savings group (ROSCA / Esusu / Chama / Stokvel). Everyone pays the same fixed amount; one member collects the pot each round. Amounts stay private."
      configured={configured}
    >
      {/* Selector + create */}
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-gold">Your circles</span>
          <button onClick={() => setShowCreate(!showCreate)} className="btn btn-ghost text-xs py-1 px-3 h-8" type="button">
            {showCreate ? "Back" : "Create circle"}
          </button>
        </div>

        {showCreate ? (
          <div className="rounded-2xl border border-gold/15 bg-ink/40 p-5 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-gold uppercase tracking-wider">Start a new circle</h3>
            <input value={circleName} onChange={(e) => setCircleName(e.target.value)} placeholder="Circle name — e.g. Nairobi Chama" className="field text-sm" />
            <textarea
              value={membersInput}
              onChange={(e) => setMembersInput(e.target.value)}
              placeholder="Initial members, comma-separated 0x… (you're included automatically)"
              rows={3}
              className="field font-mono text-xs w-full py-2 resize-none"
            />
            <button
              onClick={createCircle}
              disabled={isPending || isCreating}
              className="btn btn-primary self-start text-xs py-2 px-5 flex items-center gap-1.5"
              type="button"
            >
              {isCreating ? <Spinner /> : null}
              {isCreating ? "Deploying..." : "Deploy circle"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {activeCircles.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-gold uppercase tracking-wider opacity-60">Active Circles</span>
                <div className="flex flex-wrap gap-2.5 max-h-32 overflow-y-auto scrollbar-thin pr-1 py-1.5 px-0.5">
                  {activeCircles.map((a) => (
                    <CircleChip key={a} address={a} isActive={active === a} onClick={() => { setSelected(a); setRevealed(null); }} />
                  ))}
                </div>
              </div>
            )}

            {dissolvedCircles.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-1 border-t border-shell/5 pt-3">
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider opacity-65">Dissolved / Archive</span>
                <div className="flex flex-wrap gap-2.5 max-h-32 overflow-y-auto scrollbar-thin pr-1 py-1.5 px-0.5 opacity-65">
                  {dissolvedCircles.map((a) => (
                    <CircleChip key={a} address={a} isActive={active === a} isDissolved onClick={() => { setSelected(a); setRevealed(null); }} />
                  ))}
                </div>
              </div>
            )}

            {userCircles.length === 0 && (
              <p className="text-xs text-muted">No circles yet — create one, open a shared link, or load an address below.</p>
            )}
            <div className="flex gap-2 max-w-md items-center mt-2">
              <input value={customInput} onChange={(e) => setCustomInput(e.target.value)} placeholder="Load circle address 0x…" className="field font-mono text-xs flex-1 py-1 px-3 h-8" />
              <button onClick={loadCustom} className="btn btn-ghost text-xs py-1 px-3 h-8" type="button">Load</button>
            </div>
          </div>
        )}
      </div>

      {!showCreate && active && (
        <div>
          {/* Active circle header */}
          <div className="mb-6 rounded-2xl bg-ink/60 p-5 border border-shell/5">
            <div className="flex justify-between items-start mb-1 flex-wrap gap-2">
              <h3 className="text-base font-bold text-shell">{name ? (name as string) : "Circle"}</h3>
              <div className="flex items-center gap-2">
                <button onClick={share} className="btn btn-ghost text-[10px] py-1 px-2 h-7" type="button">Share</button>
                <span className="font-mono text-[10px] bg-ink/80 text-muted px-2 py-0.5 rounded-full border border-shell/5 break-all max-w-full">{active}</span>
              </div>
            </div>
            <p className="text-xs text-muted mb-4">Organizer: <span className="font-mono">{short(organizer as string)}</span></p>

            <ShellMeter filled={Number(filled ?? 0)} total={memberCount} />
            <p className="mt-3 text-xs uppercase tracking-wider text-muted font-semibold">
              Round {String(round ?? 0n)} • {amountSet ? "fixed amount set" : "no amount yet"}{refundOpen ? " • refund window open" : ""}
            </p>

            {/* Reveal the fixed amount (members) and the round pot total (anyone) */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {isMember && amountSet && (
                <>
                  <button onClick={revealAmount} disabled={isPending || isRevealingAmount} className="btn btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5" type="button">
                    {isRevealingAmount ? <Spinner /> : null}
                    {isRevealingAmount ? "Decrypting..." : "Reveal fixed amount"}
                  </button>
                  {revealed !== null && <span className="chip text-sea">{Number(revealed).toLocaleString()} cUSDT each</span>}
                </>
              )}
              <button onClick={revealPot} disabled={isPending || isRevealingPot} className="btn btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5" type="button">
                {isRevealingPot ? <Spinner /> : null}
                {isRevealingPot ? "Decrypting..." : "Reveal pot total"}
              </button>
              {pot !== null && <span className="chip text-gold">{Number(pot).toLocaleString()} cUSDT in pot</span>}
            </div>
            {dissolved ? <p className="mt-3 chip border-coral/40 text-coral-soft inline-flex">Circle dissolved — claim any refund</p> : null}
          </div>

          {/* Organizer: set fixed amount before start */}
          {isOrganizer && beforeStart && (
            <div className="mb-6 rounded-2xl border border-gold/15 bg-gold/5 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gold mb-1">Organizer — set the fixed amount</h4>
              <p className="text-[11px] text-muted mb-3">Everyone pays this exact (encrypted) amount each round. Set it before the first contribution.</p>
              <AmountRow
                label="Fixed amount"
                value={amountInput}
                onChange={setAmountInput}
                onSubmit={setFixedAmount}
                cta={amountSet ? "Update amount" : "Set amount"}
                busy={isSettingAmount}
                disabled={isPending}
              />
            </div>
          )}

          {/* Join / membership state */}
          {isConnected && !isMember && (
            <div className="mb-6 p-4 rounded-2xl bg-ink/40 border border-shell/5">
              {isAuthorized ? (
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                  <p className="text-xs text-shell-dim">You're whitelisted — join to participate.</p>
                  <button onClick={join} disabled={isPending || isJoining} className="btn btn-primary text-xs py-2 px-4 h-9 flex items-center gap-1.5" type="button">
                    {isJoining ? <Spinner /> : null}
                    {isJoining ? "Joining..." : "Join circle"}
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-muted">You're not a member. The organizer must authorize your address to join.</p>
              )}
            </div>
          )}

          {/* Member actions */}
          {isMember && !dissolved && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {!isApproved && (
                  <button onClick={approve} disabled={isPending || isApproving} className="btn btn-ghost text-xs py-1.5 px-3.5 flex items-center gap-1.5" type="button">
                    {isApproving ? <Spinner /> : null}
                    {isApproving ? "Approving..." : "Approve operator"}
                  </button>
                )}
                {roundComplete && !refundOpen && (
                  <button onClick={payout} disabled={isPending || isPayingOut} className="btn btn-primary text-xs py-1.5 px-3.5 flex items-center gap-1.5" type="button">
                    {isPayingOut ? <Spinner /> : null}
                    {isPayingOut ? "Paying out..." : "Payout pot"}
                  </button>
                )}
                {canClaimRefund && (
                  <button onClick={claimRefund} disabled={isPending || isClaimingRefund} className="btn btn-ghost text-xs py-1.5 px-3.5 border-coral/40 text-coral-soft flex items-center gap-1.5" type="button">
                    {isClaimingRefund ? <Spinner /> : null}
                    {isClaimingRefund ? "Claiming refund..." : "Claim refund"}
                  </button>
                )}
              </div>
              {!refundOpen && amountSet && !hasContributed && (
                <div className="flex flex-col gap-1.5">
                  <button onClick={contribute} disabled={isPending || !isApproved || isContributing} className="btn btn-primary self-start disabled:opacity-50 flex items-center gap-1.5" type="button">
                    {isContributing ? <Spinner /> : <span aria-hidden>🔒</span>}
                    {isContributing ? "Contributing..." : "Contribute the fixed amount"}
                  </button>
                  {!isApproved && <span className="text-[11px] text-coral-soft">Approve the operator first so the circle can pull your cUSDT.</span>}
                </div>
              )}
              {hasContributed && !refundOpen && <p className="text-xs text-sea">You&apos;ve contributed this round.</p>}
              {!refundOpen && (
                <button onClick={approveDissolve} disabled={isPending || isVotingDissolve} className="btn btn-ghost self-start text-[11px] py-1 px-3 text-muted flex items-center gap-1.5" type="button">
                  {isVotingDissolve ? <Spinner /> : null}
                  {isVotingDissolve ? "Voting..." : "Vote to dissolve"}
                </button>
              )}
            </div>
          )}

          {/* Organizer controls */}
          {isOrganizer && (
            <div className="mt-6 border-t border-shell/5 pt-5 flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {!dissolved && !refundOpen && (
                  <button onClick={openRefund} disabled={isPending || isOpeningRefund} className="btn btn-ghost text-xs py-1.5 px-3.5 border-coral/40 text-coral-soft flex items-center gap-1.5" type="button">
                    {isOpeningRefund ? <Spinner /> : null}
                    {isOpeningRefund ? "Opening refund..." : "Open refund window"}
                  </button>
                )}
                {!dissolved && refundOpen && (
                  <button onClick={closeRefund} disabled={isPending || isClosingRefund} className="btn btn-ghost text-xs py-1.5 px-3.5 flex items-center gap-1.5" type="button">
                    {isClosingRefund ? <Spinner /> : null}
                    {isClosingRefund ? "Closing refund..." : "Close refund window"}
                  </button>
                )}
                {!dissolved && (
                  <button onClick={dissolve} disabled={isPending || isDissolving} className="btn btn-ghost text-xs py-1.5 px-3.5 border-coral/40 text-coral-soft flex items-center gap-1.5" type="button">
                    {isDissolving ? <Spinner /> : null}
                    {isDissolving ? "Dissolving..." : "Dissolve circle"}
                  </button>
                )}
              </div>
              {beforeStart && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gold mb-2">Authorize a member</h4>
                  <div className="flex gap-2 max-w-lg">
                    <input value={newMember} onChange={(e) => setNewMember(e.target.value)} placeholder="0x…" className="field flex-1 font-mono text-sm py-2" />
                    <button onClick={authorize} disabled={isPending || isWhitelisting} className="btn btn-ghost text-xs py-2 px-4 flex items-center gap-1.5" type="button">
                      {isWhitelisting ? <Spinner /> : null}
                      {isWhitelisting ? "Whitelisting..." : "Authorize"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <StatusLine status={s.status} kind={s.kind} />
    </ModeCard>
  );
}
