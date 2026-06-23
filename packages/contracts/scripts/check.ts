import { ethers } from "hardhat";

async function main() {
  const [d] = await ethers.getSigners();
  const bal = await ethers.provider.getBalance(d.address);
  const net = await ethers.provider.getNetwork();
  console.log("Deployer:", d.address);
  console.log("Balance :", ethers.formatEther(bal), "SepoliaETH");
  console.log("ChainId :", net.chainId.toString());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
