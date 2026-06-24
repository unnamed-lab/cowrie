// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {Crowdfund} from "./Crowdfund.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title CrowdfundFactory
/// @notice Deployer and registry for dynamic Crowdfund campaigns with spam prevention.
/// @dev The creation fee is anti-spam, not revenue; the owner can withdraw the
///      accumulated fees (so funds are never permanently locked).
contract CrowdfundFactory is Ownable {
    address[] public allCampaigns;
    mapping(address => address[]) private _userCampaigns;
    mapping(address => bool) public isDeployedCampaign;

    uint256 public constant CREATION_FEE = 0.005 ether;
    uint64 public constant MIN_GOAL = 1000;
    uint256 public constant MIN_DURATION = 3600; // 1 hour

    event CampaignCreated(
        address indexed campaign,
        address indexed organizer,
        address indexed beneficiary,
        uint64 goal,
        uint256 duration
    );
    event FeesWithdrawn(address indexed to, uint256 amount);

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Deploy a new Crowdfund campaign with spam prevention.
     * @param token The ERC-7984 confidential token this campaign will operate on.
     * @param beneficiary The address that will receive the funds on success.
     * @param goal The target amount in cUSDT units.
     * @param duration The duration of the campaign in seconds.
     */
    function createCampaign(
        address token,
        address beneficiary,
        uint64 goal,
        uint256 duration,
        string calldata title,
        string calldata description
    ) external payable returns (address) {
        // Spam prevention checks
        require(msg.value >= CREATION_FEE, "insufficient creation fee (min 0.005 ETH)");
        require(goal >= MIN_GOAL, "goal too low (min 1000 cUSDT)");
        require(duration >= MIN_DURATION, "duration too short (min 1 hour)");
        require(beneficiary != address(0), "zero beneficiary");
        require(bytes(title).length > 0, "title required");

        // Deploy the new Crowdfund instance
        Crowdfund campaign = new Crowdfund(token, msg.sender, beneficiary, goal, duration, title, description);
        address campaignAddr = address(campaign);

        allCampaigns.push(campaignAddr);
        isDeployedCampaign[campaignAddr] = true;
        _userCampaigns[msg.sender].push(campaignAddr);

        emit CampaignCreated(campaignAddr, msg.sender, beneficiary, goal, duration);
        return campaignAddr;
    }

    /**
     * @notice Get all campaigns created by a specific user.
     * @param user The address to query.
     */
    function getUserCampaigns(address user) external view returns (address[] memory) {
        return _userCampaigns[user];
    }

    /**
     * @notice Get the total count of deployed campaigns.
     */
    function getCampaignsCount() external view returns (uint256) {
        return allCampaigns.length;
    }

    /**
     * @notice Withdraw accumulated anti-spam creation fees to `to`.
     * @dev Owner-only; prevents fees from being permanently locked in the factory.
     */
    function withdrawFees(address payable to) external onlyOwner {
        require(to != address(0), "zero address");
        uint256 amount = address(this).balance;
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "withdraw failed");
        emit FeesWithdrawn(to, amount);
    }
}
