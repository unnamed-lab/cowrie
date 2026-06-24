import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

/**
 * Deploys the Cowrie infrastructure: the ConfidentialUSDT token and the three
 * factories. Individual circles, streams, and campaigns are NOT deployed here —
 * users create their own instances through the factories from the dashboard, so
 * there are no hardcoded default instances.
 *
 * After deploying, copy the printed factory addresses into
 * `packages/shared/src/addresses.ts` and the README.
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  // 1. Confidential token (the money).
  const token = await deploy("ConfidentialUSDT", { from: deployer, log: true, args: [] });

  // 2. Factories — the deployers/registries for each mode.
  const circleFactory = await deploy("SavingsCircleFactory", { from: deployer, log: true, args: [] });
  const crowdfundFactory = await deploy("CrowdfundFactory", { from: deployer, log: true, args: [] });
  const payrollFactory = await deploy("PayrollStreamsFactory", { from: deployer, log: true, args: [] });

  log("\nCowrie deployed:");
  log(
    JSON.stringify(
      {
        ConfidentialUSDT: token.address,
        SavingsCircleFactory: circleFactory.address,
        CrowdfundFactory: crowdfundFactory.address,
        PayrollStreamsFactory: payrollFactory.address,
      },
      null,
      2,
    ),
  );
};

export default func;
func.id = "deploy_cowrie";
func.tags = ["Cowrie"];
