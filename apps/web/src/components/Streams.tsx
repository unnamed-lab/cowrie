"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { encryptAmount } from "@/fhe/useEncrypt";
import { PAYROLL_ABI, TOKEN_ABI, useCowrieAddresses, operatorUntil } from "@/lib/contracts";
import { ModeCard, AmountRow, StatusLine, useStatus } from "./ui";

/**
 * Streams — confidential payroll. The employer funds the pool and sets an
 * encrypted salary per employee; employees pull each period and can decrypt only
 * their own payslip.
 */
export function Streams() {
  const { address } = useAccount();
  const { addresses, configured } = useCowrieAddresses();
  const { writeContractAsync, isPending } = useWriteContract();
  const s = useStatus();

  const payroll = addresses?.PayrollStreams as `0x${string}` | undefined;
  const token = addresses?.ConfidentialUSDT as `0x${string}` | undefined;

  const [fundAmt, setFundAmt] = useState("100000");
  const [salaryAmt, setSalaryAmt] = useState("5000");
  const [employee, setEmployee] = useState("");

  const { data: isEmployee } = useReadContract({
    abi: PAYROLL_ABI,
    address: payroll,
    functionName: "isEmployee",
    args: address ? [address] : undefined,
    query: { enabled: !!payroll && !!address && configured },
  });

  async function approve() {
    if (!token || !payroll) return;
    try {
      s.working("Approving payroll to move your cUSDT…");
      await writeContractAsync({
        abi: TOKEN_ABI,
        address: token,
        functionName: "setOperator",
        args: [payroll, operatorUntil()],
      });
      s.done("Payroll approved.");
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  async function fund() {
    if (!address || !payroll) return;
    try {
      s.working("Encrypting payroll funds…");
      const { handle, inputProof } = await encryptAmount(payroll, address, BigInt(fundAmt));
      s.working("Funding…");
      await writeContractAsync({
        abi: PAYROLL_ABI,
        address: payroll,
        functionName: "fund",
        args: [handle, inputProof],
      });
      s.done("Payroll funded — the balance stays encrypted.");
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  async function setSalary() {
    if (!address || !payroll || !employee) return;
    try {
      s.working("Encrypting salary…");
      const { handle, inputProof } = await encryptAmount(payroll, address, BigInt(salaryAmt));
      s.working("Setting salary…");
      await writeContractAsync({
        abi: PAYROLL_ABI,
        address: payroll,
        functionName: "setSalary",
        args: [employee as `0x${string}`, handle, inputProof],
      });
      s.done("Salary set. Only that employee (and you) can decrypt it.");
    } catch (e) {
      s.error((e as Error).message);
    }
  }

  async function claim() {
    if (!payroll) return;
    try {
      s.working("Claiming your payslip…");
      await writeContractAsync({ abi: PAYROLL_ABI, address: payroll, functionName: "claim", args: [] });
      s.done("Claimed. The amount paid stays encrypted.");
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
      <div className="grid gap-5 sm:grid-cols-2">
        {/* Employer */}
        <div className="rounded-2xl bg-ink/60 p-5">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gold">Employer</h3>
          <button onClick={approve} className="btn btn-ghost mb-4">
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
        <div className="rounded-2xl bg-ink/60 p-5">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-sea">Employee</h3>
          <p className="mb-4 text-sm text-shell-dim">
            {isEmployee ? "You're on this payroll." : "Connected wallet is not on this payroll."}
          </p>
          <button onClick={claim} disabled={!isEmployee} className="btn btn-primary">
            <span aria-hidden>🔒</span> Claim my payslip
          </button>
        </div>
      </div>
      <StatusLine status={s.status} kind={s.kind} />
    </ModeCard>
  );
}
