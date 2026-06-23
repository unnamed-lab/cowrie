"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { encryptAmount } from "@/fhe/useEncrypt";
import { PAYROLL_ABI, TOKEN_ABI, useCowrieAddresses, operatorUntil } from "@/lib/contracts";
import { ModeCard, AmountRow, StatusLine } from "./ui";

/**
 * Streams — confidential payroll. The employer funds the pool and sets an
 * encrypted salary per employee; employees pull each period and can decrypt only
 * their own payslip.
 */
export function Streams() {
  const { address } = useAccount();
  const { addresses, configured } = useCowrieAddresses();
  const { writeContractAsync, isPending } = useWriteContract();

  const payroll = addresses?.PayrollStreams as `0x${string}` | undefined;
  const token = addresses?.ConfidentialUSDT as `0x${string}` | undefined;

  const [fundAmt, setFundAmt] = useState("100000");
  const [salaryAmt, setSalaryAmt] = useState("5000");
  const [employee, setEmployee] = useState("");
  const [status, setStatus] = useState("");

  const { data: isEmployee } = useReadContract({
    abi: PAYROLL_ABI,
    address: payroll,
    functionName: "isEmployee",
    args: address ? [address] : undefined,
    query: { enabled: !!payroll && !!address && configured },
  });

  async function approve() {
    if (!token || !payroll) return;
    setStatus("Approving payroll to move your cUSDT…");
    await writeContractAsync({
      abi: TOKEN_ABI,
      address: token,
      functionName: "setOperator",
      args: [payroll, operatorUntil()],
    });
    setStatus("Payroll approved.");
  }

  async function fund() {
    if (!address || !payroll) return;
    try {
      setStatus("Encrypting payroll funds…");
      const { handle, inputProof } = await encryptAmount(payroll, address, BigInt(fundAmt));
      setStatus("Funding…");
      await writeContractAsync({
        abi: PAYROLL_ABI,
        address: payroll,
        functionName: "fund",
        args: [handle, inputProof],
      });
      setStatus("Payroll funded — the balance stays encrypted.");
    } catch (e) {
      setStatus(`Failed: ${(e as Error).message}`);
    }
  }

  async function setSalary() {
    if (!address || !payroll || !employee) return;
    try {
      setStatus("Encrypting salary…");
      const { handle, inputProof } = await encryptAmount(payroll, address, BigInt(salaryAmt));
      setStatus("Setting salary…");
      await writeContractAsync({
        abi: PAYROLL_ABI,
        address: payroll,
        functionName: "setSalary",
        args: [employee as `0x${string}`, handle, inputProof],
      });
      setStatus("Salary set. Only that employee (and you) can decrypt it.");
    } catch (e) {
      setStatus(`Failed: ${(e as Error).message}`);
    }
  }

  async function claim() {
    if (!payroll) return;
    try {
      setStatus("Claiming your payslip…");
      await writeContractAsync({ abi: PAYROLL_ABI, address: payroll, functionName: "claim", args: [] });
      setStatus("Claimed. The amount paid stays encrypted.");
    } catch (e) {
      setStatus(`Failed: ${(e as Error).message}`);
    }
  }

  return (
    <ModeCard
      title="Streams"
      lede="Confidential payroll. Fund the pool, set encrypted salaries, employees claim their own — nobody else sees the numbers."
      configured={configured}
    >
      <div className="flex flex-col gap-6">
        <div>
          <h3 className="mb-2 text-sm font-medium">Employer</h3>
          <button
            onClick={approve}
            className="mb-3 rounded-full border px-4 py-2 text-sm"
            style={{ borderColor: "var(--color-muted)", color: "var(--color-shell)" }}
          >
            Approve payroll
          </button>
          <AmountRow value={fundAmt} onChange={setFundAmt} onSubmit={fund} cta="Fund payroll" busy={isPending} />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              value={employee}
              onChange={(e) => setEmployee(e.target.value)}
              placeholder="Employee 0x…"
              aria-label="Employee address"
              className="w-full rounded-full px-4 py-2"
              style={{ background: "var(--color-ink)", color: "var(--color-shell)" }}
            />
          </div>
          <div className="mt-3">
            <AmountRow value={salaryAmt} onChange={setSalaryAmt} onSubmit={setSalary} cta="Set salary" busy={isPending} />
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium">Employee</h3>
          <p className="mb-3 text-sm" style={{ color: "var(--color-muted)" }}>
            {isEmployee ? "You're on payroll." : "Connected wallet is not on this payroll."}
          </p>
          <button
            onClick={claim}
            disabled={!isEmployee}
            className="rounded-full px-5 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--color-coral)", color: "var(--color-ink)" }}
          >
            Claim my payslip
          </button>
        </div>
      </div>
      <StatusLine status={status} />
    </ModeCard>
  );
}
