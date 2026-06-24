"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { encryptAmount } from "@/fhe/useEncrypt";
import { publicDecryptReached } from "@/fhe/usePublicDecrypt";
import { CROWDFUND_ABI, CROWDFUND_FACTORY_ABI, TOKEN_ABI, useCowrieAddresses, operatorUntil } from "@/lib/contracts";
import { CROWDFUND_STATE } from "@cowrie/shared";
import { useDeepLink, copyShareLink } from "@/lib/deeplink";
import { ModeCard, AmountRow, StatusLine, useStatus } from "./ui";

const STATE_TONE: Record<string, string> = {
  Active: "text-sea",
  Deciding: "text-gold",
  Succeeded: "text-sea",
  Failed: "text-coral-soft",
};

/**
 * CampaignChip renders an individual campaign address in the selector,
 * reading its goal from the contract dynamically.
 */
function CampaignChip({
  address,
  isActive,
  onClick,
}: {
  address: `0x${string}`;
  isActive: boolean;
  onClick: () => void;
}) {
  const { data: goal } = useReadContract({
    abi: CROWDFUND_ABI,
    address,
    functionName: "goal",
  });

  const goalStr = goal ? `${Number(goal).toLocaleString()} cUSDT` : `Campaign (${address.slice(0, 6)}…)`;

  return (
    <button
      onClick={onClick}
      type="button"
      className={`chip text-xs font-semibold py-2 px-3 transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
        isActive
          ? "border-sea bg-sea/15 text-sea shadow-md shadow-sea/5 scale-105"
          : "border-shell/10 bg-ink/40 text-shell-dim hover:border-sea/30 hover:bg-sea/5"
      }`}
    >
      <span className="font-sans">{goalStr}</span>
      <span className="text-[9px] opacity-60 font-mono">
        {address.slice(0, 6)}…{address.slice(-4)}
      </span>
    </button>
  );
}

/**
 * Pools — dynamic confidential crowdfunding dashboard.
 * Contributions accumulate encrypted; the only thing ever revealed is a
 * single boolean: did the encrypted total reach the public goal?
 * Campaigns can be deployed dynamically with spam-prevention stakes.
 */
export function Pools() {
  const { address, isConnected } = useAccount();
  const { addresses, configured } = useCowrieAddresses();
  const { writeContractAsync, isPending } = useWriteContract();
  const s = useStatus();

  // Selected campaign state — no hardcoded default; comes from a deep link, a
  // manual load, or the first campaign you created.
  const deepLinked = useDeepLink("campaign");
  const [selectedCampaignAddress, setSelectedCampaignAddress] = useState<string | undefined>(undefined);
  const activeCampaignAddress = selectedCampaignAddress as `0x${string}` | undefined;

  // Custom load and creation state
  const [customAddressInput, setCustomAddressInput] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [campaignTitle, setCampaignTitle] = useState("");
  const [campaignDescription, setCampaignDescription] = useState("");
  const [campaignBeneficiary, setCampaignBeneficiary] = useState("");
  const [campaignGoal, setCampaignGoal] = useState("5000");
  const [campaignDuration, setCampaignDuration] = useState("3600"); // default 1 hour in seconds

  const [amount, setAmount] = useState("250");

  const token = addresses?.ConfidentialUSDT as `0x${string}` | undefined;

  // Read list of user campaigns from the Factory registry
  const { data: userCampaignsData, refetch: refetchUserCampaigns } = useReadContract({
    abi: CROWDFUND_FACTORY_ABI,
    address: addresses?.CrowdfundFactory as `0x${string}` | undefined,
    functionName: "getUserCampaigns",
    args: address ? [address] : undefined,
    query: { enabled: !!addresses?.CrowdfundFactory && !!address && configured },
  });

  // Campaigns you created, from the factory registry.
  const userCampaigns = (userCampaignsData as `0x${string}`[]) || [];
  const allUserCampaigns = Array.from(
    new Set(userCampaigns.filter((addr) => !!addr && addr !== "0x0000000000000000000000000000000000000000")),
  );

  // Auto-select: deep link wins, else the first campaign you created.
  useEffect(() => {
    if (deepLinked) setSelectedCampaignAddress(deepLinked);
  }, [deepLinked]);
  useEffect(() => {
    if (!selectedCampaignAddress && allUserCampaigns.length > 0) setSelectedCampaignAddress(allUserCampaigns[0]);
  }, [selectedCampaignAddress, allUserCampaigns]);

  async function shareCampaign() {
    if (!activeCampaignAddress) return;
    await copyShareLink("campaign", activeCampaignAddress);
    s.done("Share link copied — opens this campaign for whoever you send it to.");
  }

  // Read active campaign state details
  const { data: state, refetch: refetchState } = useReadContract({
    abi: CROWDFUND_ABI,
    address: activeCampaignAddress,
    functionName: "state",
    query: { enabled: !!activeCampaignAddress && configured },
  });
  const { data: goal, refetch: refetchGoal } = useReadContract({
    abi: CROWDFUND_ABI,
    address: activeCampaignAddress,
    functionName: "goal",
    query: { enabled: !!activeCampaignAddress && configured },
  });
  const { data: deadline, refetch: refetchDeadline } = useReadContract({
    abi: CROWDFUND_ABI,
    address: activeCampaignAddress,
    functionName: "deadline",
    query: { enabled: !!activeCampaignAddress && configured },
  });
  const { data: beneficiary, refetch: refetchBeneficiary } = useReadContract({
    abi: CROWDFUND_ABI,
    address: activeCampaignAddress,
    functionName: "beneficiary",
    query: { enabled: !!activeCampaignAddress && configured },
  });
  const { refetch: refetchReached } = useReadContract({
    abi: CROWDFUND_ABI,
    address: activeCampaignAddress,
    functionName: "reachedHandle",
    query: { enabled: false },
  });

  const stateName = state !== undefined ? CROWDFUND_STATE[Number(state)] : "—";
  const deadlineDate = deadline ? new Date(Number(deadline) * 1000) : undefined;
  const isDeadlinePassed = deadlineDate ? Date.now() > deadlineDate.getTime() : false;

  const refetchAll = () => {
    refetchState();
    refetchGoal();
    refetchDeadline();
    refetchBeneficiary();
    refetchUserCampaigns();
  };

  // Actions
  async function approve() {
    if (!token || !activeCampaignAddress) return;
    try {
      s.working("Approving the campaign to move your cUSDT…");
      await writeContractAsync({
        abi: TOKEN_ABI,
        address: token,
        functionName: "setOperator",
        args: [activeCampaignAddress, operatorUntil()],
      });
      s.done("Campaign approved.");
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  async function contribute() {
    if (!address || !activeCampaignAddress) return;
    try {
      s.working("Encrypting your contribution…");
      const { handle, inputProof } = await encryptAmount(activeCampaignAddress, address, BigInt(amount));
      s.working("Contributing privately…");
      await writeContractAsync({
        abi: CROWDFUND_ABI,
        address: activeCampaignAddress,
        functionName: "contribute",
        args: [handle, inputProof],
      });
      s.done("Contributed. Only the goal/total comparison is ever revealed — never your amount.");
      refetchAll();
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  async function finalize() {
    if (!activeCampaignAddress) return;
    try {
      s.working("Finalizing — comparing the encrypted total against the goal…");
      await writeContractAsync({ abi: CROWDFUND_ABI, address: activeCampaignAddress, functionName: "finalize", args: [] });
      s.done("Finalized. Now reveal & settle the goal boolean.");
      refetchAll();
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  async function revealAndSettle() {
    if (!activeCampaignAddress) return;
    try {
      s.working("Fetching the encrypted goal-reached handle…");
      const { data: handle } = await refetchReached();
      if (!handle) throw new Error("No handle yet — finalize first.");
      s.working("Publicly decrypting the single boolean (KMS)…");
      const { reached, cleartexts, decryptionProof } = await publicDecryptReached(handle as string);
      s.working(`Goal reached: ${reached}. Submitting the proof on-chain…`);
      await writeContractAsync({
        abi: CROWDFUND_ABI,
        address: activeCampaignAddress,
        functionName: "settle",
        args: [cleartexts, decryptionProof],
      });
      s.done(`Settled — campaign ${reached ? "Succeeded" : "Failed"}.`);
      refetchAll();
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  function action(fn: "release" | "refund") {
    if (!activeCampaignAddress) return;
    writeContractAsync({ abi: CROWDFUND_ABI, address: activeCampaignAddress, functionName: fn, args: [] })
      .then(() => {
        s.done(fn === "release" ? "Released to the beneficiary." : "Refund sent.");
        refetchAll();
      })
      .catch((e) => s.error((e as Error).message));
  }

  // Load custom campaign address
  function loadCustomAddress() {
    if (!customAddressInput.startsWith("0x") || customAddressInput.length !== 42) {
      s.error("Invalid Ethereum address format.");
      return;
    }
    setSelectedCampaignAddress(customAddressInput);
    setCustomAddressInput("");
    s.done(`Loaded campaign at ${customAddressInput}`);
  }

  // Create new campaign via factory
  async function handleCreateCampaign() {
    if (!token || !addresses?.CrowdfundFactory) return;
    try {
      if (!campaignTitle.trim()) throw new Error("A campaign title is required.");
      s.working("Deploying new crowdfunding campaign (requires 0.005 ETH stake)…");
      const beneficiaryAddr = (campaignBeneficiary || address) as `0x${string}`;
      if (!beneficiaryAddr) throw new Error("Must specify a beneficiary address.");

      const goalVal = BigInt(campaignGoal);
      const durationSec = BigInt(campaignDuration);

      await writeContractAsync({
        abi: CROWDFUND_FACTORY_ABI,
        address: addresses.CrowdfundFactory as `0x${string}`,
        functionName: "createCampaign",
        args: [token, beneficiaryAddr, goalVal, durationSec, campaignTitle.trim(), campaignDescription.trim()],
        value: 5000000000000000n, // 0.005 ETH
      });

      s.done("New crowdfunding campaign deployed successfully!");
      setShowCreateForm(false);
      refetchUserCampaigns();
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  return (
    <ModeCard
      title="Pools"
      lede="Confidential community crowdfunding (Harambee). Contributions stay encrypted; only a single boolean — goal reached or not — is ever revealed."
      configured={configured}
      badge={
        !showCreateForm && activeCampaignAddress ? (
          <span className={`chip ${STATE_TONE[stateName] ?? ""}`}>
            <span className="h-2 w-2 rounded-full bg-current" aria-hidden /> {stateName}
          </span>
        ) : undefined
      }
    >
      {/* Campaign selector and creation manager */}
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-sea">Select Campaign</span>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn btn-ghost text-xs py-1 px-3 h-8"
            type="button"
          >
            {showCreateForm ? "Back to Dashboard" : "Create Campaign"}
          </button>
        </div>

        {showCreateForm ? (
          <div className="rounded-2xl border border-sea/15 bg-ink/40 p-5 flex flex-col gap-4 animate-fade-in">
            <h3 className="text-sm font-bold text-sea uppercase tracking-wider">Start a New Harambee Campaign</h3>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-muted tracking-wider uppercase">
                Title (what you&apos;re raising for)
              </label>
              <input
                value={campaignTitle}
                onChange={(e) => setCampaignTitle(e.target.value)}
                placeholder="e.g. Clean water for Kibera school"
                className="field text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-muted tracking-wider uppercase">
                Description (optional — why it matters)
              </label>
              <textarea
                value={campaignDescription}
                onChange={(e) => setCampaignDescription(e.target.value)}
                placeholder="Tell contributors what their donation supports…"
                rows={2}
                className="field text-sm w-full py-2 resize-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-muted tracking-wider uppercase">
                Beneficiary Address (receiver of funds on success)
              </label>
              <input
                value={campaignBeneficiary}
                onChange={(e) => setCampaignBeneficiary(e.target.value)}
                placeholder={address ? `Default: ${address.slice(0, 6)}…` : "0x…"}
                className="field text-sm font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-muted tracking-wider uppercase">
                Target Goal (cUSDT)
              </label>
              <input
                value={campaignGoal}
                onChange={(e) => setCampaignGoal(e.target.value)}
                placeholder="e.g. 5000"
                className="field text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-muted tracking-wider uppercase">
                Campaign Duration
              </label>
              <select
                value={campaignDuration}
                onChange={(e) => setCampaignDuration(e.target.value)}
                className="field text-sm"
              >
                <option value="3600">1 Hour (Test Mode)</option>
                <option value="86400">1 Day</option>
                <option value="604800">1 Week</option>
                <option value="2592000">30 Days</option>
              </select>
              <p className="text-[10px] text-muted leading-relaxed">
                Deploying a campaign requires a <strong>0.005 ETH</strong> anti-spam stake and a minimum goal of <strong>1000 cUSDT</strong>.
              </p>
            </div>

            <button
              onClick={handleCreateCampaign}
              disabled={isPending}
              className="btn btn-primary self-start text-xs py-2 px-5 bg-sea hover:bg-sea/85"
              type="button"
            >
              Deploy Campaign Contract
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Active campaigns chips */}
            <div className="flex flex-wrap gap-2.5">
              {allUserCampaigns.map((addr) => (
                <CampaignChip
                  key={addr}
                  address={addr}
                  isActive={activeCampaignAddress === addr}
                  onClick={() => setSelectedCampaignAddress(addr)}
                />
              ))}
            </div>

            {/* Custom address loader */}
            <div className="flex gap-2 max-w-md items-center">
              <input
                value={customAddressInput}
                onChange={(e) => setCustomAddressInput(e.target.value)}
                placeholder="Load campaign address 0x…"
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

      {!showCreateForm && activeCampaignAddress && (
        <div className="animate-fade-in flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Goal Panel */}
            <div className="rounded-2xl bg-ink/60 px-5 py-4 border border-shell/5">
              <span className="text-xs uppercase tracking-wider text-muted font-semibold">Public Goal Target</span>
              <p className="font-display text-2xl text-gold mt-1">
                {Number(goal ?? 0n).toLocaleString()} <span className="text-sm text-muted">cUSDT</span>
              </p>
            </div>

            {/* Deadline Panel */}
            <div className="rounded-2xl bg-ink/60 px-5 py-4 border border-shell/5">
              <span className="text-xs uppercase tracking-wider text-muted font-semibold">Deadline</span>
              <p className="text-sm font-semibold mt-2 text-shell">
                {deadlineDate ? (
                  isDeadlinePassed ? (
                    <span className="text-coral-soft">Expired ({deadlineDate.toLocaleString()})</span>
                  ) : (
                    <span>Active until {deadlineDate.toLocaleString()}</span>
                  )
                ) : (
                  "—"
                )}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-ink/60 p-5 border border-shell/5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gold">Campaign Details</h3>
              <button onClick={shareCampaign} className="btn btn-ghost text-[10px] py-1 px-2 h-7" type="button">Share</button>
            </div>
            <p className="text-xs text-muted leading-relaxed font-mono break-all">
              Campaign address: {activeCampaignAddress}
              <br />
              Beneficiary: {beneficiary ? (beneficiary as string) : "—"}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-4">
            <button onClick={approve} className="btn btn-ghost self-start text-xs py-1.5 px-3">
              Approve Campaign Operator
            </button>
            <AmountRow value={amount} onChange={setAmount} onSubmit={contribute} cta="Contribute privately" busy={isPending} />
          </div>

          {/* Lifecycle management — each step is enabled only when it applies, so
              the order (finalize → reveal & settle → release/refund) is obvious. */}
          <div className="mt-6 border-t border-shell/10 pt-5">
            <p className="mb-1 text-xs uppercase tracking-wider text-muted font-semibold">Lifecycle Operations</p>
            <p className="mb-3 text-[11px] text-muted">
              {stateName === "Active" && (isDeadlinePassed ? "Deadline passed — finalize to compare the encrypted total to the goal." : "Running — finalize is available after the deadline.")}
              {stateName === "Deciding" && "Finalized — reveal & settle the single goal-reached boolean to decide the outcome."}
              {stateName === "Succeeded" && "Goal reached — the beneficiary can release the funds."}
              {stateName === "Failed" && "Goal not reached — contributors can claim a refund."}
            </p>
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={finalize}
                disabled={isPending || stateName !== "Active" || !isDeadlinePassed}
                title={stateName !== "Active" ? "Already finalized." : !isDeadlinePassed ? "Available after the deadline." : "Compare the encrypted total to the goal."}
                className="btn btn-ghost text-xs py-2 px-4 h-9 disabled:opacity-40"
              >
                1 · Finalize
              </button>
              <button
                onClick={revealAndSettle}
                disabled={isPending || stateName !== "Deciding"}
                title={stateName !== "Deciding" ? "Finalize first." : "Reveal the goal-reached boolean and settle on-chain."}
                className="btn btn-ghost text-xs py-2 px-4 h-9 disabled:opacity-40"
              >
                2 · Reveal &amp; settle
              </button>
              <button
                onClick={() => action("release")}
                disabled={isPending || stateName !== "Succeeded"}
                title={stateName !== "Succeeded" ? "Only after the goal is reached." : "Send funds to the beneficiary."}
                className="btn btn-ghost text-xs py-2 px-4 h-9 disabled:opacity-40"
              >
                Release funds
              </button>
              <button
                onClick={() => action("refund")}
                disabled={isPending || stateName !== "Failed"}
                title={stateName !== "Failed" ? "Only if the campaign failed." : "Reclaim your contribution."}
                className="btn btn-ghost text-xs py-2 px-4 h-9 disabled:opacity-40 border-coral/40 text-coral-soft"
              >
                Claim refund
              </button>
            </div>
          </div>
        </div>
      )}

      <StatusLine status={s.status} kind={s.kind} />
    </ModeCard>
  );
}
