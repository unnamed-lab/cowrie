import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ConfidentialUSDT, Crowdfund } from "../types";

const UNTIL = 9_999_999_999;
const DAY = 24 * 60 * 60;
const GOAL = 1_000n;

/**
 * These tests cover the privacy-preserving heart of the mode: contributions stay
 * encrypted, and `finalize()` reveals ONLY a single boolean — whether the
 * encrypted total met the public goal. We assert that boolean via the mock
 * public-decryption helper.
 *
 * The on-chain `settle(cleartexts, proof)` -> release/refund path requires a real
 * KMS-signed decryption proof, which only the live relayer produces; it is
 * exercised from the dashboard against Sepolia, not in the mock runtime.
 */
describe("Crowdfund", () => {
  let beneficiary: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let token: ConfidentialUSDT;
  let tokenAddr: string;

  beforeEach(async function () {
    if (!fhevm.isMock) this.skip();
    [beneficiary, alice, bob] = await ethers.getSigners();
    token = (await ethers.deployContract("ConfidentialUSDT")) as ConfidentialUSDT;
    tokenAddr = await token.getAddress();
  });

  async function deployCampaign(duration: number) {
    const cf = (await ethers.deployContract("Crowdfund", [
      tokenAddr,
      beneficiary.address,
      beneficiary.address,
      GOAL,
      duration,
    ])) as Crowdfund;
    return { cf, addr: await cf.getAddress() };
  }

  async function fundAndApprove(who: HardhatEthersSigner, campaign: string, amount: number) {
    await (await token.connect(who).faucet(amount)).wait();
    await (await token.connect(who).setOperator(campaign, UNTIL)).wait();
  }

  async function contribute(cf: Crowdfund, addr: string, who: HardhatEthersSigner, amount: number) {
    const enc = await fhevm.createEncryptedInput(addr, who.address).add64(amount).encrypt();
    await (await cf.connect(who).contribute(enc.handles[0], enc.inputProof)).wait();
  }

  it("reveals goal-reached = true when the encrypted total meets the goal", async () => {
    const { cf, addr } = await deployCampaign(DAY);
    await fundAndApprove(alice, addr, 600);
    await fundAndApprove(bob, addr, 600);

    await contribute(cf, addr, alice, 600);
    await contribute(cf, addr, bob, 600); // total 1200 >= 1000

    await time.increase(DAY + 1);
    await (await cf.finalize()).wait();
    expect(await cf.state()).to.equal(1n); // Deciding

    const reachedHandle = await cf.reachedHandle();
    expect(await fhevm.publicDecryptEbool(reachedHandle)).to.equal(true);
  });

  it("reveals goal-reached = false when the total falls short", async () => {
    const { cf, addr } = await deployCampaign(DAY);
    await fundAndApprove(alice, addr, 100);
    await contribute(cf, addr, alice, 100); // total 100 < 1000

    await time.increase(DAY + 1);
    await (await cf.finalize()).wait();

    const reachedHandle = await cf.reachedHandle();
    expect(await fhevm.publicDecryptEbool(reachedHandle)).to.equal(false);
  });

  it("blocks contributions after the deadline and finalize before it", async () => {
    const { cf, addr } = await deployCampaign(DAY);
    await fundAndApprove(alice, addr, 100);

    await expect(cf.finalize()).to.be.revertedWith("not yet");

    await time.increase(DAY + 1);
    await expect(contribute(cf, addr, alice, 100)).to.be.revertedWith("closed");
  });
});
