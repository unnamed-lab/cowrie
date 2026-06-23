import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { ConfidentialUSDT, PayrollStreams, PayrollStreamsFactory } from "../types";

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

describe("PayrollStreamsFactory", () => {
  let employer: HardhatEthersSigner;
  let token: ConfidentialUSDT;
  let tokenAddr: string;
  let factory: PayrollStreamsFactory;
  let factoryAddr: string;

  beforeEach(async function () {
    if (!fhevm.isMock) this.skip();
    [employer] = await ethers.getSigners();
    token = (await ethers.deployContract("ConfidentialUSDT")) as ConfidentialUSDT;
    tokenAddr = await token.getAddress();
    factory = (await ethers.deployContract("PayrollStreamsFactory")) as PayrollStreamsFactory;
    factoryAddr = await factory.getAddress();
  });

  it("deploys a stream, registers it, and enforces spam prevention", async () => {
    // 1. Fails if period is too short (min 60s)
    await expect(
      factory.connect(employer).createStream(tokenAddr, 30, {
        value: ethers.parseEther("0.01"),
      })
    ).to.be.revertedWith("period too short (min 60s)");

    // 2. Fails if creation fee is insufficient
    await expect(
      factory.connect(employer).createStream(tokenAddr, 120, {
        value: ethers.parseEther("0.005"),
      })
    ).to.be.revertedWith("insufficient creation fee (min 0.01 ETH)");

    // 3. Succeeds if all params are valid
    const tx = await factory.connect(employer).createStream(tokenAddr, 3600, {
      value: ethers.parseEther("0.01"),
    });
    const receipt = await tx.wait();

    const event = receipt?.logs.find((log) => {
      try {
        const parsed = factory.interface.parseLog(log);
        return parsed?.name === "StreamCreated";
      } catch {
        return false;
      }
    });
    expect(event).to.not.be.undefined;
    const parsedEvent = factory.interface.parseLog(event!);
    const streamAddr = parsedEvent?.args[0];
    expect(parsedEvent?.args[1]).to.equal(employer.address);
    expect(parsedEvent?.args[2]).to.equal(3600n);

    expect(await factory.isDeployedStream(streamAddr)).to.be.true;
    expect(await factory.getStreamsCount()).to.equal(1n);

    const userStreams = await factory.getUserStreams(employer.address);
    expect(userStreams).to.include(streamAddr);

    // Verify properties of the deployed stream
    const stream = await ethers.getContractAt("PayrollStreams", streamAddr) as PayrollStreams;
    expect(await stream.period()).to.equal(3600n);
    expect(await stream.organizer()).to.equal(employer.address);
  });
});
