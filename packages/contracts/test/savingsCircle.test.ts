import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { ConfidentialUSDT, SavingsCircle } from "../types";

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
      [alice.address, bob.address],
    ])) as SavingsCircle;
    circleAddr = await circle.getAddress();

    await (await token.connect(alice).faucet(1_000)).wait();
    await (await token.connect(bob).faucet(1_000)).wait();
    await (await token.connect(alice).setOperator(circleAddr, UNTIL)).wait();
    await (await token.connect(bob).setOperator(circleAddr, UNTIL)).wait();
  });

  async function contribute(signer: HardhatEthersSigner, amount: number) {
    const enc = await fhevm.createEncryptedInput(circleAddr, signer.address).add64(amount).encrypt();
    await (await circle.connect(signer).contribute(enc.handles[0], enc.inputProof)).wait();
  }

  it("rotates the encrypted pot to the round's recipient", async () => {
    await contribute(alice, 100);
    await contribute(bob, 100);

    expect(await circle.contributionsThisRound()).to.equal(2n);

    await (await circle.payout()).wait();
    expect(await circle.round()).to.equal(1n);

    // Round 0 recipient is members[0] = alice: she contributed 100 and received the
    // 200 pot, so net +100 over her starting 1000 → 1100. Bob is at 900.
    expect(await userBalance(token, tokenAddr, alice)).to.equal(1_100n);
    expect(await userBalance(token, tokenAddr, bob)).to.equal(900n);
  });

  it("rejects a double contribution in the same round", async () => {
    await contribute(alice, 100);
    await expect(contribute(alice, 100)).to.be.revertedWith("already contributed");
  });

  it("blocks payout until the round is complete", async () => {
    await contribute(alice, 100);
    await expect(circle.payout()).to.be.revertedWith("round not complete");
  });
});
