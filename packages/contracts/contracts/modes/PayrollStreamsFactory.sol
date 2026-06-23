// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {PayrollStreams} from "./PayrollStreams.sol";

/// @title PayrollStreamsFactory
/// @notice Deployer and registry for dynamic PayrollStreams instances with spam prevention.
contract PayrollStreamsFactory {
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
}
