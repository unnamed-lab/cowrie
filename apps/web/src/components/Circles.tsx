"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useSignTypedData } from "wagmi";
import { encryptAmount } from "@/fhe/useEncrypt";
import { decryptHandle } from "@/fhe/useUserDecrypt";
import { CIRCLE_ABI, FACTORY_ABI, TOKEN_ABI, useCowrieAddresses, operatorUntil } from "@/lib/contracts";
import { useDeepLink, copyShareLink } from "@/lib/deeplink";
import { ShellMeter } from "./ShellMeter";
import { ModeCard, AmountRow, StatusLine, useStatus } from "./ui";

const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

function CircleChip({ address, isActive, onClick }: { address: `0x${string}`; isActive: boolean; onClick: () => void }) {
  const { data: name } = useReadContract({ abi: CIRCLE_ABI, address, functionName: "name" });
  return (
    <button
      onClick={onClick}
      type="button"
      className={`chip text-xs font-semibold py-2 px-3 transition-all cursor-pointer flex items-center gap-1.5 ${
        isActive ? "border-gold bg-gold/15 text-gold" : "border-shell/10 bg-ink/40 text-shell-dim hover:border-gold/30"
      }`}
    >
      <span className="font-sans">{name ? (name as string) : "Circle"}</span>
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
  const { writeContractAsync, isPending } = useWriteContract();
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

  // Auto-select: deep link wins, else the first circle you belong to.
  useEffect(() => {
    if (deepLinked) setSelected(deepLinked);
  }, [deepLinked]);
  useEffect(() => {
    if (!selected && userCircles.length > 0) setSelected(userCircles[0]);
  }, [selected, userCircles]);

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

  const isOrganizer = !!address && !!organizer && address.toLowerCase() === (organizer as string).toLowerCase();
  const beforeStart = round === 0n && Number(filled ?? 0) === 0;
  const memberCount = members ? (members as string[]).length : 0;
  const roundComplete = filled !== undefined && memberCount > 0 && Number(filled) === memberCount;
  const canClaimRefund = !!refundOpen && !!hasContributed && !hasRefunded;

  async function tx(fn: () => Promise<unknown>, working: string, done: string) {
    try {
      s.working(working);
      await fn();
      s.done(done);
      setTimeout(() => refetchList(), 1500);
    } catch (e) {
      s.error(e);
    }
  }

  const approve = () =>
    tx(
      () => writeContractAsync({ abi: TOKEN_ABI, address: token!, functionName: "setOperator", args: [active!, operatorUntil()] }),
      "Approving the circle to move your cUSDT…",
      "Circle approved.",
    );

  async function setFixedAmount() {
    if (!address || !active) return;
    try {
      s.working("Encrypting the fixed contribution amount…");
      const { handle, inputProof } = await encryptAmount(active, address, BigInt(amountInput));
      s.working("Setting the amount everyone will pay…");
      await writeContractAsync({ abi: CIRCLE_ABI, address: active, functionName: "setFixedAmount", args: [handle, inputProof] });
      s.done("Fixed amount set. Members can now contribute equally.");
    } catch (e) {
      s.error(e);
    }
  }

  const contribute = () =>
    tx(
      () => writeContractAsync({ abi: CIRCLE_ABI, address: active!, functionName: "contribute", args: [] }),
      "Contributing the fixed amount (stays encrypted)…",
      "Contributed privately.",
    );

  const join = () =>
    tx(() => writeContractAsync({ abi: CIRCLE_ABI, address: active!, functionName: "join", args: [] }), "Joining the circle…", "Joined.");

  const authorize = () =>
    tx(
      () => writeContractAsync({ abi: CIRCLE_ABI, address: active!, functionName: "authorizeMember", args: [newMember as `0x${string}`] }),
      "Whitelisting member…",
      "Member authorized.",
    ).then(() => setNewMember(""));

  const payout = () =>
    tx(() => writeContractAsync({ abi: CIRCLE_ABI, address: active!, functionName: "payout", args: [] }), "Paying out the pot…", "Pot rotated to the next recipient.");

  const openRefund = () =>
    tx(() => writeContractAsync({ abi: CIRCLE_ABI, address: active!, functionName: "openRefund", args: [] }), "Opening the refund window…", "Refund window open — members can reclaim.");
  const closeRefund = () =>
    tx(() => writeContractAsync({ abi: CIRCLE_ABI, address: active!, functionName: "closeRefund", args: [] }), "Closing the refund window…", "Refund window closed.");
  const claimRefund = () =>
    tx(() => writeContractAsync({ abi: CIRCLE_ABI, address: active!, functionName: "claimRefund", args: [] }), "Reclaiming your contribution…", "Refund sent back to you.");

  async function revealAmount() {
    if (!active || !address) return;
    try {
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
            <button onClick={createCircle} disabled={isPending} className="btn btn-primary self-start text-xs py-2 px-5" type="button">
              Deploy circle
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2.5">
              {userCircles.length === 0 && (
                <p className="text-xs text-muted">No circles yet — create one, open a shared link, or load an address below.</p>
              )}
              {userCircles.map((a) => (
                <CircleChip key={a} address={a} isActive={active === a} onClick={() => { setSelected(a); setRevealed(null); }} />
              ))}
            </div>
            <div className="flex gap-2 max-w-md items-center">
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

            {/* Members can reveal the fixed amount */}
            {isMember && amountSet && (
              <div className="mt-3 flex items-center gap-3">
                <button onClick={revealAmount} className="btn btn-ghost text-xs py-1.5 px-3" type="button">Reveal fixed amount</button>
                {revealed !== null && <span className="chip text-sea">{Number(revealed).toLocaleString()} cUSDT each</span>}
              </div>
            )}
          </div>

          {/* Organizer: set fixed amount before start */}
          {isOrganizer && beforeStart && (
            <div className="mb-6 rounded-2xl border border-gold/15 bg-gold/5 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gold mb-1">Organizer — set the fixed amount</h4>
              <p className="text-[11px] text-muted mb-3">Everyone pays this exact (encrypted) amount each round. Set it before the first contribution.</p>
              <AmountRow label="Fixed amount" value={amountInput} onChange={setAmountInput} onSubmit={setFixedAmount} cta={amountSet ? "Update amount" : "Set amount"} busy={isPending} />
            </div>
          )}

          {/* Join / membership state */}
          {isConnected && !isMember && (
            <div className="mb-6 p-4 rounded-2xl bg-ink/40 border border-shell/5">
              {isAuthorized ? (
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                  <p className="text-xs text-shell-dim">You're whitelisted — join to participate.</p>
                  <button onClick={join} className="btn btn-primary text-xs py-2 px-4 h-9" type="button">Join circle</button>
                </div>
              ) : (
                <p className="text-[11px] text-muted">You're not a member. The organizer must authorize your address to join.</p>
              )}
            </div>
          )}

          {/* Member actions */}
          {isMember && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={approve} className="btn btn-ghost text-xs py-1.5 px-3.5" type="button">Approve operator</button>
                {roundComplete && !refundOpen && (
                  <button onClick={payout} disabled={isPending} className="btn btn-primary text-xs py-1.5 px-3.5" type="button">Payout pot</button>
                )}
                {canClaimRefund && (
                  <button onClick={claimRefund} disabled={isPending} className="btn btn-ghost text-xs py-1.5 px-3.5 border-coral/40 text-coral-soft" type="button">Claim refund</button>
                )}
              </div>
              {!refundOpen && amountSet && !hasContributed && (
                <button onClick={contribute} disabled={isPending} className="btn btn-primary self-start" type="button">
                  <span aria-hidden>🔒</span> Contribute the fixed amount
                </button>
              )}
              {hasContributed && !refundOpen && <p className="text-xs text-sea">You've contributed this round.</p>}
            </div>
          )}

          {/* Organizer controls */}
          {isOrganizer && (
            <div className="mt-6 border-t border-shell/5 pt-5 flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {!refundOpen ? (
                  <button onClick={openRefund} className="btn btn-ghost text-xs py-1.5 px-3.5 border-coral/40 text-coral-soft" type="button">Open refund window</button>
                ) : (
                  <button onClick={closeRefund} className="btn btn-ghost text-xs py-1.5 px-3.5" type="button">Close refund window</button>
                )}
              </div>
              {beforeStart && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gold mb-2">Authorize a member</h4>
                  <div className="flex gap-2 max-w-lg">
                    <input value={newMember} onChange={(e) => setNewMember(e.target.value)} placeholder="0x…" className="field flex-1 font-mono text-sm py-2" />
                    <button onClick={authorize} className="btn btn-ghost text-xs py-2 px-4" type="button">Authorize</button>
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
