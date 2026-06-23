import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { ConfidentialUSDT, PayrollStreams } from "../types";

const UNTIL = 9_999_999_999;
const WEEK = 7 * 24 * 60 * 60;

describe("PayrollStreams", () => {
  let employer: HardhatEthersSigner;
  let employee: HardhatEthersSigner;
  let token: ConfidentialUSDT;
  let tokenAddr: string;
  let payroll: PayrollStreams;
  let payrollAddr: string;

  beforeEach(async function () {
    if (!fhevm.isMock) this.skip();
    [employer, employee] = await ethers.getSigners();

    token = (await ethers.deployContract("ConfidentialUSDT")) as ConfidentialUSDT;
    tokenAddr = await token.getAddress();
    payroll = (await ethers.deployContract("PayrollStreams", [
      tokenAddr,
      employer.address,
      WEEK,
    ])) as PayrollStreams;
    payrollAddr = await payroll.getAddress();

    await (await token.connect(employer).faucet(100_000)).wait();
    await (await token.connect(employer).setOperator(payrollAddr, UNTIL)).wait();
  });

  async function encrypt(signer: HardhatEthersSigner, amount: number) {
    return fhevm.createEncryptedInput(payrollAddr, signer.address).add64(amount).encrypt();
  }

  it("funds, sets an encrypted salary, and pays the employee on claim", async () => {
    const fundEnc = await encrypt(employer, 100_000);
    await (await payroll.connect(employer).fund(fundEnc.handles[0], fundEnc.inputProof)).wait();

    const salEnc = await encrypt(employer, 5_000);
    await (await payroll.connect(employer).setSalary(employee.address, salEnc.handles[0], salEnc.inputProof)).wait();

    // Employee can decrypt their own payslip.
    const salaryHandle = await payroll.salaryOf(employee.address);
    expect(await fhevm.userDecryptEuint(FhevmType.euint64, salaryHandle, payrollAddr, employee)).to.equal(5_000n);

    await (await payroll.connect(employee).claim()).wait();

    const balHandle = await token.confidentialBalanceOf(employee.address);
    expect(await fhevm.userDecryptEuint(FhevmType.euint64, balHandle, tokenAddr, employee)).to.equal(5_000n);
  });

  it("enforces the claim period", async () => {
    const fundEnc = await encrypt(employer, 100_000);
    await (await payroll.connect(employer).fund(fundEnc.handles[0], fundEnc.inputProof)).wait();
    const salEnc = await encrypt(employer, 5_000);
    await (await payroll.connect(employer).setSalary(employee.address, salEnc.handles[0], salEnc.inputProof)).wait();

    await (await payroll.connect(employee).claim()).wait();
    await expect(payroll.connect(employee).claim()).to.be.revertedWith("too soon");

    await time.increase(WEEK);
    await (await payroll.connect(employee).claim()).wait(); // succeeds after a period

    const balHandle = await token.confidentialBalanceOf(employee.address);
    expect(await fhevm.userDecryptEuint(FhevmType.euint64, balHandle, tokenAddr, employee)).to.equal(10_000n);
  });

  it("only the organizer can fund or set salaries", async () => {
    const enc = await encrypt(employee, 1);
    await expect(payroll.connect(employee).fund(enc.handles[0], enc.inputProof)).to.be.revertedWith("not organizer");
  });
});
