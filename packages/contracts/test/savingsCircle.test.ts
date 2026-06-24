import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { ConfidentialUSDT, SavingsCircle, SavingsCircleFactory } from "../types";

const UNTIL = 9_999_999_999; // far-future uint48 operator expiry

async function userBalance(token: ConfidentialUSDT, tokenAddr: string, who: HardhatEthersSigner) {
  const handle = await token.confidentialBalanceOf(who.address);
  if (handle === ethers.ZeroHash) return 0n;
  return fhevm.userDecryptEuint(FhevmType.euint64, handle, tokenAddr, who);
}

describe("SavingsCircle", () => {
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let token: ConfidentialUSDT;
  let tokenAddr: string;
  let circle: SavingsCircle;
  let circleAddr: string;

  beforeEach(async function () {
    if (!fhevm.isMock) this.skip();
    [alice, bob] = await ethers.getSigners();

    token = (await ethers.deployContract("ConfidentialUSDT")) as ConfidentialUSDT;
    tokenAddr = await token.getAddress();

    circle = (await ethers.deployContract("SavingsCircle", [
      tokenAddr,
      alice.address,
      "Test Circle",
      [alice.address, bob.address],
    ])) as SavingsCircle;
    circleAddr = await circle.getAddress();

    await (await token.connect(alice).faucet(1_000)).wait();
    await (await token.connect(bob).faucet(1_000)).wait();
    await (await token.connect(alice).setOperator(circleAddr, UNTIL)).wait();
    await (await token.connect(bob).setOperator(circleAddr, UNTIL)).wait();

    // Organizer sets the fixed per-round contribution (encrypted) to 100.
    const enc = await fhevm.createEncryptedInput(circleAddr, alice.address).add64(100).encrypt();
    await (await circle.connect(alice).setFixedAmount(enc.handles[0], enc.inputProof)).wait();
  });

  async function contribute(signer: HardhatEthersSigner) {
    await (await circle.connect(signer).contribute()).wait();
  }

  it("requires the organizer to set the fixed amount before contributing", async () => {
    const fresh = (await ethers.deployContract("SavingsCircle", [
      tokenAddr,
      alice.address,
      "No-Amount Circle",
      [alice.address, bob.address],
    ])) as SavingsCircle;
    await (await token.connect(alice).setOperator(await fresh.getAddress(), UNTIL)).wait();
    await expect(fresh.connect(alice).contribute()).to.be.revertedWith("fixed amount not set");
  });

  it("rotates the encrypted pot to the round's recipient (equal fixed contributions)", async () => {
    await contribute(alice);
    await contribute(bob);

    expect(await circle.contributionsThisRound()).to.equal(2n);

    await (await circle.payout()).wait();
    expect(await circle.round()).to.equal(1n);

    // Round 0 recipient is members[0] = alice: she paid 100 and received the 200
    // pot, so net +100 over her starting 1000 → 1100. Bob is at 900.
    expect(await userBalance(token, tokenAddr, alice)).to.equal(1_100n);
    expect(await userBalance(token, tokenAddr, bob)).to.equal(900n);
  });

  it("rejects a double contribution in the same round", async () => {
    await contribute(alice);
    await expect(contribute(alice)).to.be.revertedWith("already contributed");
  });

  it("blocks payout until the round is complete", async () => {
    await contribute(alice);
    await expect(circle.payout()).to.be.revertedWith("round not complete");
  });

  it("refunds a member's contribution during the refund window (pull)", async () => {
    await contribute(alice);
    await contribute(bob);

    // Organizer opens the refund window; payout is blocked while open.
    await (await circle.connect(alice).openRefund()).wait();
    await expect(circle.payout()).to.be.revertedWith("refund window open");

    // Bob reclaims his own contribution; pot and counters reflect it.
    await (await circle.connect(bob).claimRefund()).wait();
    expect(await circle.contributionsThisRound()).to.equal(1n);
    expect(await userBalance(token, tokenAddr, bob)).to.equal(1_000n); // back to start

    // Re-contributing is blocked while the window is open, allowed once closed.
    await expect(circle.connect(bob).contribute()).to.be.revertedWith("refund window open");
    await (await circle.connect(alice).closeRefund()).wait();
    await (await circle.connect(bob).contribute()).wait();
    expect(await circle.contributionsThisRound()).to.equal(2n);
  });

  it("only the organizer can open the refund window", async () => {
    await expect(circle.connect(bob).openRefund()).to.be.revertedWith("only organizer");
  });

  it("enforces organizer authorization for dynamic membership joins", async () => {
    // Deploy a separate circle with only alice (organizer) as initial member
    const dynamicCircle = (await ethers.deployContract("SavingsCircle", [
      tokenAddr,
      alice.address,
      "Dynamic Circle",
      [alice.address],
    ])) as SavingsCircle;

    // Bob tries to join without authorization and should be rejected
    await expect(dynamicCircle.connect(bob).join()).to.be.revertedWith("not authorized to join");

    // Alice (organizer) whitelists Bob
    await (await dynamicCircle.connect(alice).authorizeMember(bob.address)).wait();

    // Bob can now join successfully
    await (await dynamicCircle.connect(bob).join()).wait();
    expect(await dynamicCircle.isMember(bob.address)).to.be.true;
    expect(await dynamicCircle.memberCount()).to.equal(2n);
  });
});

describe("SavingsCircleFactory", () => {
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let token: ConfidentialUSDT;
  let tokenAddr: string;
  let factory: SavingsCircleFactory;
  let factoryAddr: string;

  beforeEach(async function () {
    if (!fhevm.isMock) this.skip();
    [alice, bob] = await ethers.getSigners();

    token = (await ethers.deployContract("ConfidentialUSDT")) as ConfidentialUSDT;
    tokenAddr = await token.getAddress();

    factory = (await ethers.deployContract("SavingsCircleFactory")) as SavingsCircleFactory;
    factoryAddr = await factory.getAddress();
  });

  it("deploys a new circle, whitelists organizer + initial members and maps them", async () => {
    const initialMembers = [alice.address, bob.address];
    const tx = await factory.connect(alice).createCircle(tokenAddr, "My Custom Circle", initialMembers);
    const receipt = await tx.wait();

    // Verify CircleCreated event
    const event = receipt?.logs.find((log) => {
      try {
        const parsed = factory.interface.parseLog(log);
        return parsed?.name === "CircleCreated";
      } catch {
        return false;
      }
    });
    expect(event).to.not.be.undefined;
    const parsedEvent = factory.interface.parseLog(event!);
    const circleAddr = parsedEvent?.args[0];
    expect(parsedEvent?.args[1]).to.equal(alice.address);
    expect(parsedEvent?.args[2]).to.equal("My Custom Circle");

    expect(await factory.isDeployedCircle(circleAddr)).to.be.true;
    expect(await factory.getCirclesCount()).to.equal(1n);

    // Verify user membership lists
    const aliceCircles = await factory.getUserCircles(alice.address);
    const bobCircles = await factory.getUserCircles(bob.address);
    expect(aliceCircles).to.include(circleAddr);
    expect(bobCircles).to.include(circleAddr);

    // Verify deployed circle properties
    const circleInstance = await ethers.getContractAt("SavingsCircle", circleAddr) as SavingsCircle;
    expect(await circleInstance.name()).to.equal("My Custom Circle");
    expect(await circleInstance.organizer()).to.equal(alice.address);
    expect(await circleInstance.factory()).to.equal(factoryAddr);
    expect(await circleInstance.isMember(alice.address)).to.be.true;
    expect(await circleInstance.isMember(bob.address)).to.be.true;
  });

  it("registers dynamic join mapping in the factory", async () => {
    const initialMembers = [alice.address];
    const tx = await factory.connect(alice).createCircle(tokenAddr, "Dynamic Join Circle", initialMembers);
    const receipt = await tx.wait();

    // Verify CircleCreated event
    const event = receipt?.logs.find((log) => {
      try {
        const parsed = factory.interface.parseLog(log);
        return parsed?.name === "CircleCreated";
      } catch {
        return false;
      }
    });
    expect(event).to.not.be.undefined;
    const parsedEvent = factory.interface.parseLog(event!);
    const circleAddr = parsedEvent?.args[0];

    const circleInstance = await ethers.getContractAt("SavingsCircle", circleAddr) as SavingsCircle;

    // Bob tries to join - should fail until authorized
    await expect(circleInstance.connect(bob).join()).to.be.revertedWith("not authorized to join");

    // Alice authorizes Bob
    await (await circleInstance.connect(alice).authorizeMember(bob.address)).wait();

    // Bob joins
    await (await circleInstance.connect(bob).join()).wait();

    // Verify Bob is now mapped to this circle in the factory
    const bobCircles = await factory.getUserCircles(bob.address);
    expect(bobCircles).to.include(circleAddr);
  });
});

