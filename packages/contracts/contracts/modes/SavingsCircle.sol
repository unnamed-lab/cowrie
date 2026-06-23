// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ConfidentialPoolBase} from "../base/ConfidentialPoolBase.sol";

/// @title SavingsCircle (ROSCA / esusu / tanda / hui)
/// @notice Rotating savings circle. Each round every member contributes an
///         encrypted amount into a shared pot; the whole pot rotates to one
///         member per round. Only `FHE.add` is used — no comparisons, no async
///         decryption. The rotation order is public by design (`round`); only the
///         amounts are encrypted.
contract SavingsCircle is ConfidentialPoolBase {
    address[] public members;
    mapping(address => bool) public isMember;

    /// @notice Whose turn it is to collect (public by design).
    uint256 public round;
    /// @notice How many members have contributed in the current round.
    uint256 public contributionsThisRound;

    euint64 private _pot; // encrypted accumulated pot for the current round
    mapping(uint256 => mapping(address => bool)) public contributed;

    event Contributed(address indexed member, uint256 indexed round);
    event PaidOut(address indexed recipient, uint256 indexed round);

    constructor(
        address token_,
        address organizer_,
        address[] memory members_
    ) ConfidentialPoolBase(token_, organizer_) {
        require(members_.length >= 2, "need members");
        members = members_;
        for (uint256 i; i < members_.length; ++i) {
            require(!isMember[members_[i]], "dup member");
            isMember[members_[i]] = true;
        }
        _pot = FHE.asEuint64(0);
        FHE.allowThis(_pot);
    }

    /// @notice Contribute an encrypted amount to this round's pot.
    /// @dev Caller must have approved this circle as an ERC-7984 operator.
    function contribute(externalEuint64 enc, bytes calldata proof) external {
        require(isMember[msg.sender], "not a member");
        require(!contributed[round][msg.sender], "already contributed");
        contributed[round][msg.sender] = true;
        contributionsThisRound += 1;

        euint64 amount = _ingest(enc, proof);
        euint64 moved = _pull(msg.sender, amount);
        _pot = FHE.add(_pot, moved);
        FHE.allowThis(_pot);
        emit Contributed(msg.sender, round);
    }

    /// @notice Pay the encrypted pot to this round's recipient, then rotate.
    /// @dev Requires every member to have contributed this round.
    function payout() external {
        require(contributionsThisRound == members.length, "round not complete");
        address recipient = members[round % members.length];

        _push(recipient, _pot);
        emit PaidOut(recipient, round);

        round += 1;
        contributionsThisRound = 0;
        _pot = FHE.asEuint64(0);
        FHE.allowThis(_pot);
    }

    function memberCount() external view returns (uint256) {
        return members.length;
    }
}
