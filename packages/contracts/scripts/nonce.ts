import { ethers } from "hardhat";
async function main() {
  const [d] = await ethers.getSigners();
  const latest = await ethers.provider.getTransactionCount(d.address, "latest");
  const pending = await ethers.provider.getTransactionCount(d.address, "pending");
  const fee = await ethers.provider.getFeeData();
  console.log("latest nonce:", latest, "pending nonce:", pending);
  console.log("gasPrice:", fee.gasPrice?.toString(), "maxFee:", fee.maxFeePerGas?.toString());
}
main().catch((e)=>{console.error(e);process.exitCode=1;});
