"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { encryptAmount } from "@/fhe/useEncrypt";
import { PAYROLL_ABI, PAYROLL_FACTORY_ABI, TOKEN_ABI, useCowrieAddresses, operatorUntil } from "@/lib/contracts";
import { ModeCard, AmountRow, StatusLine, useStatus } from "./ui";
import { LockIcon } from "./Icons";

/**
 * StreamChip renders an individual payroll stream address in the list,
 * displaying its period and address.
 */
function StreamChip({
  address,
  isActive,
  onClick,
}: {
  address: `0x${string}`;
  isActive: boolean;
  onClick: () => void;
}) {
  const { data: period } = useReadContract({
    abi: PAYROLL_ABI,
    address,
    functionName: "period",
  });

  const periodStr = period ? `${Number(period) / 3600}h` : "Payroll";

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
      <span className="font-sans">{periodStr} Period</span>
      <span className="text-[9px] opacity-60 font-mono">
        {address.slice(0, 6)}…{address.slice(-4)}
      </span>
    </button>
  );
}

/**
 * Streams — dynamic confidential payroll dashboard.
 * The employer funds the pool and sets an encrypted salary per employee;
 * employees pull each period and can decrypt only their own payslip.
 */
export function Streams() {
  const { address, isConnected } = useAccount();
  const { addresses, configured } = useCowrieAddresses();
  const { writeContractAsync, isPending } = useWriteContract();
  const s = useStatus();

  // Selected stream state
  const defaultStreamAddr = addresses?.PayrollStreams as `0x${string}` | undefined;
  const [selectedStreamAddress, setSelectedStreamAddress] = useState<string | undefined>(undefined);
  const activeStreamAddress = (selectedStreamAddress || defaultStreamAddr) as `0x${string}` | undefined;

  // Custom load and creation state
  const [customAddressInput, setCustomAddressInput] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [streamPeriodInput, setStreamPeriodInput] = useState("3600"); // default 1 hour in seconds

  // Main payroll inputs
  const [fundAmt, setFundAmt] = useState("100000");
  const [salaryAmt, setSalaryAmt] = useState("5000");
  const [employee, setEmployee] = useState("");

  const token = addresses?.ConfidentialUSDT as `0x${string}` | undefined;

  // Read list of user streams from the Factory registry
  const { data: userStreamsData, refetch: refetchUserStreams } = useReadContract({
    abi: PAYROLL_FACTORY_ABI,
    address: addresses?.PayrollStreamsFactory as `0x${string}` | undefined,
    functionName: "getUserStreams",
    args: address ? [address] : undefined,
    query: { enabled: !!addresses?.PayrollStreamsFactory && !!address && configured },
  });

  // Extract unique stream addresses
  const userStreams = (userStreamsData as `0x${string}`[]) || [];
  const allUserStreams = Array.from(
    new Set(
      [defaultStreamAddr, ...userStreams].filter(
        (addr): addr is `0x${string}` => !!addr && addr !== "0x0000000000000000000000000000000000000000"
      )
    )
  );

  // Read active stream details
  const { data: period, refetch: refetchPeriod } = useReadContract({
    abi: PAYROLL_ABI,
    address: activeStreamAddress,
    functionName: "period",
    query: { enabled: !!activeStreamAddress && configured },
  });
  const { data: isEmployee, refetch: refetchIsEmployee } = useReadContract({
    abi: PAYROLL_ABI,
    address: activeStreamAddress,
    functionName: "isEmployee",
    args: address ? [address] : undefined,
    query: { enabled: !!activeStreamAddress && !!address && configured },
  });
  const { data: organizer, refetch: refetchOrganizer } = useReadContract({
    abi: PAYROLL_ABI,
    address: activeStreamAddress,
    functionName: "organizer",
    query: { enabled: !!activeStreamAddress && configured },
  });

  const isCurrentOrganizer = address && organizer && address.toLowerCase() === (organizer as string).toLowerCase();

  const refetchAll = () => {
    refetchPeriod();
    refetchIsEmployee();
    refetchOrganizer();
    refetchUserStreams();
  };

  // Actions
  async function approve() {
    if (!token || !activeStreamAddress) return;
    try {
      s.working("Approving payroll to move your cUSDT…");
      await writeContractAsync({
        abi: TOKEN_ABI,
        address: token,
        functionName: "setOperator",
        args: [activeStreamAddress, operatorUntil()],
      });
      s.done("Payroll approved.");
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  async function fund() {
    if (!address || !activeStreamAddress) return;
    try {
      s.working("Encrypting payroll funds…");
      const { handle, inputProof } = await encryptAmount(activeStreamAddress, address, BigInt(fundAmt));
      s.working("Funding payroll stream…");
      await writeContractAsync({
        abi: PAYROLL_ABI,
        address: activeStreamAddress,
        functionName: "fund",
        args: [handle, inputProof],
      });
      s.done("Payroll funded — the balance stays encrypted.");
      refetchAll();
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  async function setSalary() {
    if (!address || !activeStreamAddress || !employee) return;
    try {
      s.working("Encrypting salary amount…");
      const { handle, inputProof } = await encryptAmount(activeStreamAddress, address, BigInt(salaryAmt));
      s.working("Setting salary…");
      await writeContractAsync({
        abi: PAYROLL_ABI,
        address: activeStreamAddress,
        functionName: "setSalary",
        args: [employee as `0x${string}`, handle, inputProof],
      });
      s.done("Salary set. Only that employee (and you) can decrypt it.");
      refetchAll();
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  async function claim() {
    if (!activeStreamAddress) return;
    try {
      s.working("Claiming your payslip…");
      await writeContractAsync({ abi: PAYROLL_ABI, address: activeStreamAddress, functionName: "claim", args: [] });
      s.done("Claimed. The amount paid stays encrypted.");
      refetchAll();
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  // Load custom stream address
  function loadCustomAddress() {
    if (!customAddressInput.startsWith("0x") || customAddressInput.length !== 42) {
      s.error("Invalid Ethereum address format.");
      return;
    }
    setSelectedStreamAddress(customAddressInput);
    setCustomAddressInput("");
    s.done(`Loaded stream at ${customAddressInput}`);
  }

  // Create new stream via factory
  async function handleCreateStream() {
    if (!token || !addresses?.PayrollStreamsFactory) return;
    try {
      s.working("Deploying new payroll stream (requires 0.01 ETH stake)…");
      const periodSec = BigInt(streamPeriodInput);

      await writeContractAsync({
        abi: PAYROLL_FACTORY_ABI,
        address: addresses.PayrollStreamsFactory as `0x${string}`,
        functionName: "createStream",
        args: [token, periodSec],
        value: 10000000000000000n, // 0.01 ETH
      });

      s.done("New payroll stream deployed successfully!");
      setShowCreateForm(false);
      refetchUserStreams();
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  return (
    <ModeCard
      title="Streams"
      lede="Confidential payroll. Fund the pool, set encrypted salaries, employees claim their own — nobody else sees the numbers."
      configured={configured}
    >
      {/* Stream selector and creation manager */}
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-sea">Select Stream</span>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn btn-ghost text-xs py-1 px-3 h-8"
            type="button"
          >
            {showCreateForm ? "Back to Dashboard" : "Create Stream"}
          </button>
        </div>

        {showCreateForm ? (
          <div className="rounded-2xl border border-sea/15 bg-ink/40 p-5 flex flex-col gap-4 animate-fade-in">
            <h3 className="text-sm font-bold text-sea uppercase tracking-wider">Start a New Payroll Stream</h3>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-muted tracking-wider uppercase">
                Claim Period (seconds)
              </label>
              <select
                value={streamPeriodInput}
                onChange={(e) => setStreamPeriodInput(e.target.value)}
                className="field text-sm"
              >
                <option value="60">1 Minute (Test Mode)</option>
                <option value="3600">1 Hour</option>
                <option value="86400">1 Day (Daily)</option>
                <option value="604800">1 Week (Weekly)</option>
                <option value="2592000">30 Days (Monthly)</option>
              </select>
              <p className="text-[10px] text-muted leading-relaxed">
                Employees can claim their encrypted salary only once per period. 
                Creating a stream requires a <strong>0.01 ETH</strong> anti-spam stake.
              </p>
            </div>

            <button
              onClick={handleCreateStream}
              disabled={isPending}
              className="btn btn-primary self-start text-xs py-2 px-5 bg-sea hover:bg-sea/85"
              type="button"
            >
              Deploy Stream Contract
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Active stream list chips */}
            <div className="flex flex-wrap gap-2.5">
              {allUserStreams.map((addr) => (
                <StreamChip
                  key={addr}
                  address={addr}
                  isActive={activeStreamAddress === addr}
                  onClick={() => setSelectedStreamAddress(addr)}
                />
              ))}
            </div>

            {/* Custom address loader */}
            <div className="flex gap-2 max-w-md items-center">
              <input
                value={customAddressInput}
                onChange={(e) => setCustomAddressInput(e.target.value)}
                placeholder="Load stream address 0x…"
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

      {!showCreateForm && activeStreamAddress && (
        <div className="grid gap-5 sm:grid-cols-2 animate-fade-in">
          {/* Employer */}
          <div className="rounded-2xl bg-ink/60 p-5 border border-shell/5 relative overflow-hidden">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gold">Employer Console</h3>
            
            <p className="text-xs text-muted mb-4 break-all">
              Stream Address: <span className="font-mono">{activeStreamAddress}</span>
              <br />
              Period: <span className="font-semibold text-shell">{period ? `${Number(period)} seconds` : "—"}</span>
            </p>

            <button onClick={approve} className="btn btn-ghost mb-4 text-xs py-1.5 px-3">
              Approve payroll
            </button>

            <div className="flex flex-col gap-4">
              <AmountRow label="Fund the pool" value={fundAmt} onChange={setFundAmt} onSubmit={fund} cta="Fund" busy={isPending} />
              
              <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
                Employee address
                <input
                  value={employee}
                  onChange={(e) => setEmployee(e.target.value)}
                  placeholder="0x…"
                  className="field font-mono text-sm"
                />
              </label>
              <AmountRow label="Salary" value={salaryAmt} onChange={setSalaryAmt} onSubmit={setSalary} cta="Set salary" busy={isPending} />
            </div>
          </div>

          {/* Employee */}
          <div className="rounded-2xl bg-ink/60 p-5 border border-shell/5 relative overflow-hidden flex flex-col justify-between">
            <div>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-sea">Employee Console</h3>
              <p className="mb-4 text-sm text-shell-dim">
                {isEmployee ? "You're on this payroll." : "Connected wallet is not on this payroll."}
              </p>
            </div>

            <div>
              <button onClick={claim} disabled={!isEmployee} className="btn btn-primary bg-sea hover:bg-sea/85 w-full flex items-center justify-center gap-2">
                <LockIcon className="h-3.5 w-3.5" /> Claim my payslip
              </button>
            </div>
          </div>
        </div>
      )}

      <StatusLine status={s.status} kind={s.kind} />
    </ModeCard>
  );
}
