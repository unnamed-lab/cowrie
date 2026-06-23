// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {SavingsCircle} from "./SavingsCircle.sol";

/// @title SavingsCircleFactory
/// @notice Deployer and registry for dynamic SavingsCircle instances.
contract SavingsCircleFactory {
    address[] public allCircles;
    mapping(address => address[]) private _userCircles;
    mapping(address => bool) public isDeployedCircle;

    event CircleCreated(address indexed circle, address indexed organizer, string name);

    /**
     * @notice Deploy a new SavingsCircle and register initial members.
     * @param token The ERC-7984 confidential token this circle will operate on.
     * @param name The public name of the circle.
     * @param initialMembers The list of initial members (must include the organizer).
     */
    function createCircle(
        address token,
        string calldata name,
        address[] calldata initialMembers
    ) external returns (address) {
        // Deploy the new SavingsCircle instance
        SavingsCircle circle = new SavingsCircle(token, msg.sender, name, initialMembers);
        address circleAddr = address(circle);

        allCircles.push(circleAddr);
        isDeployedCircle[circleAddr] = true;

        // Register initial members to this circle
        for (uint256 i = 0; i < initialMembers.length; ++i) {
            _userCircles[initialMembers[i]].push(circleAddr);
        }

        emit CircleCreated(circleAddr, msg.sender, name);
        return circleAddr;
    }

    /**
     * @notice Register a member joining a circle dynamically.
     * @dev Only callable by a factory-deployed SavingsCircle contract.
     * @param user The address of the user who joined.
     */
    function registerUserJoin(address user) external {
        require(isDeployedCircle[msg.sender], "only factory deployed circles");
        
        // Ensure no duplicate registrations
        address[] storage list = _userCircles[user];
        for (uint256 i = 0; i < list.length; ++i) {
            if (list[i] == msg.sender) return;
        }
        
        list.push(msg.sender);
    }

    /**
     * @notice Get all circles a specific user belongs to.
     * @param user The address to query.
     */
    function getUserCircles(address user) external view returns (address[] memory) {
        return _userCircles[user];
    }

    /**
     * @notice Get the total count of deployed circles.
     */
    function getCirclesCount() external view returns (uint256) {
        return allCircles.length;
    }
}
