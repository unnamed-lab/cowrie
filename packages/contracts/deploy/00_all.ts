import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

/**
 * Deploys the full Cowrie stack: the ConfidentialUSDT token, then the three
 * modes (SavingsCircle, PayrollStreams, Crowdfund) that share its rails.
 *
 * After deploying, copy the printed addresses into
 * `packages/shared/src/addresses.ts` and the README.
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  // 1. Confidential token (the money).
  const token = await deploy("ConfidentialUSDT", {
    from: deployer,
    log: true,
    args: [],
  });

  // 2. Savings circle — demo with the deployer as the sole seed member; in a real
  //    circle pass the full member list. Needs >= 2 members, so we add a second
  //    well-known dev address as a placeholder.
  const members = [deployer, "0x000000000000000000000000000000000000dEaD"];
  const circle = await deploy("SavingsCircle", {
    from: deployer,
    log: true,
    args: [token.address, deployer, members],
  });

  // 3. Payroll, weekly period.
  const week = 7 * 24 * 60 * 60;
  const payroll = await deploy("PayrollStreams", {
    from: deployer,
    log: true,
    args: [token.address, deployer, week],
  });

  // 4. Crowdfund: goal 1_000_000 cUSDT units, 7-day window, deployer as beneficiary.
  const crowdfund = await deploy("Crowdfund", {
    from: deployer,
    log: true,
    args: [token.address, deployer, deployer, 1_000_000n, week],
  });

  log("\nCowrie deployed:");
  log(JSON.stringify(
    {
      ConfidentialUSDT: token.address,
      SavingsCircle: circle.address,
      PayrollStreams: payroll.address,
      Crowdfund: crowdfund.address,
    },
    null,
    2,
  ));
};

export default func;
func.id = "deploy_cowrie";
func.tags = ["Cowrie"];
