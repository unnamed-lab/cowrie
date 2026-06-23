// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {PayrollStreams} from "./PayrollStreams.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title PayrollStreamsFactory
/// @notice Deployer and registry for dynamic PayrollStreams instances with spam prevention.
/// @dev The creation fee is anti-spam, not revenue; the owner can withdraw the
///      accumulated fees (so funds are never permanently locked).
contract PayrollStreamsFactory is Ownable {
    address[] public allStreams;
    mapping(address => address[]) private _userStreams;
    mapping(address => bool) public isDeployedStream;

    uint256 public constant CREATION_FEE = 0.01 ether;
    uint256 public constant MIN_PERIOD = 60; // 1 minute

    event StreamCreated(
        address indexed stream,
        address indexed organizer,
        uint256 period
    );
    event FeesWithdrawn(address indexed to, uint256 amount);

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Deploy a new PayrollStreams contract with spam prevention.
     * @param token The ERC-7984 confidential token this payroll operates on.
     * @param period The wait time between claims in seconds.
     */
    function createStream(
        address token,
        uint256 period
    ) external payable returns (address) {
        // Spam prevention checks
        require(msg.value >= CREATION_FEE, "insufficient creation fee (min 0.01 ETH)");
        require(period >= MIN_PERIOD, "period too short (min 60s)");

        // Deploy the new PayrollStreams instance
        PayrollStreams stream = new PayrollStreams(token, msg.sender, period);
        address streamAddr = address(stream);

        allStreams.push(streamAddr);
        isDeployedStream[streamAddr] = true;
        _userStreams[msg.sender].push(streamAddr);

        emit StreamCreated(streamAddr, msg.sender, period);
        return streamAddr;
    }

    /**
     * @notice Get all streams created by a specific user.
     * @param user The address to query.
     */
    function getUserStreams(address user) external view returns (address[] memory) {
        return _userStreams[user];
    }

    /**
     * @notice Get the total count of deployed streams.
     */
    function getStreamsCount() external view returns (uint256) {
        return allStreams.length;
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
