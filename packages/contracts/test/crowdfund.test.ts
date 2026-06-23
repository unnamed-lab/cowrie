import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ConfidentialUSDT, Crowdfund, CrowdfundFactory } from "../types";

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

describe("CrowdfundFactory", () => {
  let beneficiary: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let token: ConfidentialUSDT;
  let tokenAddr: string;
  let factory: CrowdfundFactory;
  let factoryAddr: string;

  beforeEach(async function () {
    if (!fhevm.isMock) this.skip();
    [beneficiary, alice] = await ethers.getSigners();
    token = (await ethers.deployContract("ConfidentialUSDT")) as ConfidentialUSDT;
    tokenAddr = await token.getAddress();
    factory = (await ethers.deployContract("CrowdfundFactory")) as CrowdfundFactory;
    factoryAddr = await factory.getAddress();
  });

  it("deploys a campaign, registers it, and enforces spam prevention", async () => {
    // 1. Fails if goal is too low (min 1000)
    await expect(
      factory.connect(alice).createCampaign(tokenAddr, beneficiary.address, 500, 3600, {
        value: ethers.parseEther("0.01"),
      })
    ).to.be.revertedWith("goal too low (min 1000 cUSDT)");

    // 2. Fails if duration is too short (min 1 hour)
    await expect(
      factory.connect(alice).createCampaign(tokenAddr, beneficiary.address, 1000, 1800, {
        value: ethers.parseEther("0.01"),
      })
    ).to.be.revertedWith("duration too short (min 1 hour)");

    // 3. Fails if creation fee is insufficient
    await expect(
      factory.connect(alice).createCampaign(tokenAddr, beneficiary.address, 1000, 3600, {
        value: ethers.parseEther("0.005"),
      })
    ).to.be.revertedWith("insufficient creation fee (min 0.01 ETH)");

    // 4. Succeeds if all params are valid
    const tx = await factory.connect(alice).createCampaign(tokenAddr, beneficiary.address, 1500, 7200, {
      value: ethers.parseEther("0.01"),
    });
    const receipt = await tx.wait();

    const event = receipt?.logs.find((log) => {
      try {
        const parsed = factory.interface.parseLog(log);
        return parsed?.name === "CampaignCreated";
      } catch {
        return false;
      }
    });
    expect(event).to.not.be.undefined;
    const parsedEvent = factory.interface.parseLog(event!);
    const campaignAddr = parsedEvent?.args[0];
    expect(parsedEvent?.args[1]).to.equal(alice.address);
    expect(parsedEvent?.args[2]).to.equal(beneficiary.address);
    expect(parsedEvent?.args[3]).to.equal(1500n);
    expect(parsedEvent?.args[4]).to.equal(7200n);

    expect(await factory.isDeployedCampaign(campaignAddr)).to.be.true;
    expect(await factory.getCampaignsCount()).to.equal(1n);

    const userCampaigns = await factory.getUserCampaigns(alice.address);
    expect(userCampaigns).to.include(campaignAddr);

    // Verify properties of the deployed campaign
    const campaign = await ethers.getContractAt("Crowdfund", campaignAddr) as Crowdfund;
    expect(await campaign.goal()).to.equal(1500n);
    expect(await campaign.beneficiary()).to.equal(beneficiary.address);
    expect(await campaign.organizer()).to.equal(alice.address);
  });
});
