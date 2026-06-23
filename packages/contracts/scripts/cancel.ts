import { ethers } from "hardhat";
async function main() {
  const [d] = await ethers.getSigners();
  const nonce = 15;
  console.log("Cancelling stuck nonce", nonce, "with a 0-value self-tx at 3 gwei...");
  const tx = await d.sendTransaction({
    to: d.address,
    value: 0,
    nonce,
    gasPrice: 3_000_000_000n,
    gasLimit: 21000,
  });
  console.log("replacement tx:", tx.hash);
  await tx.wait();
  console.log("confirmed. new latest nonce:", await ethers.provider.getTransactionCount(d.address, "latest"));
}
main().catch((e)=>{console.error(e.message ?? e);process.exitCode=1;});
