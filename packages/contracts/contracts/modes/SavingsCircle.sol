// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ConfidentialPoolBase} from "../base/ConfidentialPoolBase.sol";

interface ISavingsCircleFactory {
    function registerUserJoin(address user) external;
}

/// @title SavingsCircle (ROSCA / esusu / tanda / hui)
/// @notice Rotating savings circle. Each round every member contributes an
///         encrypted amount into a shared pot; the whole pot rotates to one
///         member per round. Only `FHE.add` is used — no comparisons, no async
///         decryption. The rotation order is public by design (`round`); only the
///         amounts are encrypted.
contract SavingsCircle is ConfidentialPoolBase {
    address[] public members;
    mapping(address => bool) public isMember;
    mapping(address => bool) public isAuthorized;

    /// @notice Whose turn it is to collect (public by design).
    uint256 public round;
    /// @notice How many members have contributed in the current round.
    uint256 public contributionsThisRound;

    euint64 private _pot; // encrypted accumulated pot for the current round
    mapping(uint256 => mapping(address => bool)) public contributed;

    /// @notice The fixed per-round contribution every member pays (encrypted).
    ///         Set by the organizer before the circle starts; members can decrypt
    ///         it but the public cannot.
    euint64 private _fixedAmount;
    /// @notice Whether the organizer has set the fixed contribution amount.
    bool public amountSet;

    /// @notice When true, contributions/payout pause and members may self-refund
    ///         their contribution for the current round.
    bool public refundOpen;
    mapping(uint256 => mapping(address => euint64)) private _paid; // actual amount pulled, per round/member
    mapping(uint256 => mapping(address => bool)) public refunded;

    /// @notice Permanently wound down (a tombstone — EIP-6780 means we can't truly
    ///         selfdestruct). When dissolved, refunds stay open and nothing else runs.
    bool public dissolved;
    mapping(address => bool) public dissolveApproved;
    uint256 public dissolveApprovals;

    event Contributed(address indexed member, uint256 indexed round);
    event PaidOut(address indexed recipient, uint256 indexed round);
    event AmountSet(address indexed organizer);
    event RefundOpened(uint256 indexed round);
    event RefundClosed(uint256 indexed round);
    event Refunded(address indexed member, uint256 indexed round);
    event DissolveApproved(address indexed member, uint256 approvals, uint256 needed);
    event Dissolved();

    string public name;
    address public immutable factory;

    constructor(
        address token_,
        address organizer_,
        string memory name_,
        address[] memory members_
    ) ConfidentialPoolBase(token_, organizer_) {
        require(members_.length >= 1, "need at least one member (organizer)");
        name = name_;
        factory = msg.sender;
        members = members_;
        for (uint256 i; i < members_.length; ++i) {
            require(!isMember[members_[i]], "dup member");
            isMember[members_[i]] = true;
            isAuthorized[members_[i]] = true; // Pre-authorize initial members
        }
        _pot = FHE.asEuint64(0);
        FHE.allowThis(_pot);
        FHE.makePubliclyDecryptable(_pot); // pot total is visible for accountability; gifts are not
    }

    /// @notice Authorize an address to join the savings circle (only organizer).
    function authorizeMember(address member) external {
        require(msg.sender == organizer, "only organizer");
        require(round == 0 && contributionsThisRound == 0, "circle already started");
        require(!isAuthorized[member], "already authorized");
        isAuthorized[member] = true;
    }

    /// @notice Join the savings circle as a member before the first round starts.
    /// @dev Requires the caller to be authorized by the organizer.
    function join() external {
        require(round == 0 && contributionsThisRound == 0, "circle already started");
        require(isAuthorized[msg.sender], "not authorized to join");
        require(!isMember[msg.sender], "already a member");
        isMember[msg.sender] = true;
        members.push(msg.sender);

        // If the fixed amount is already set, let the new member decrypt it too.
        if (amountSet) {
            FHE.allow(_fixedAmount, msg.sender);
        }

        // Register user in the factory database if deployed via factory
        if (factory != address(0) && factory.code.length > 0) {
            try ISavingsCircleFactory(factory).registerUserJoin(msg.sender) {} catch {}
        }
    }

    /// @notice Get all registered members of the savings circle.
    function getMembers() external view returns (address[] memory) {
        return members;
    }

    /// @notice Set the fixed contribution amount everyone pays each round.
    /// @dev Organizer-only, before the circle starts. The amount is encrypted;
    ///      members are granted decryption so they know what they'll pay.
    function setFixedAmount(externalEuint64 enc, bytes calldata proof) external {
        require(msg.sender == organizer, "only organizer");
        require(round == 0 && contributionsThisRound == 0, "circle already started");
        euint64 amount = _ingest(enc, proof);
        _fixedAmount = amount;
        FHE.allowThis(_fixedAmount);
        for (uint256 i; i < members.length; ++i) {
            FHE.allow(_fixedAmount, members[i]);
        }
        amountSet = true;
        emit AmountSet(msg.sender);
    }

    /// @notice Contribute the fixed amount to this round's pot — everyone pays equally.
    /// @dev Caller must have approved this circle as an ERC-7984 operator.
    function contribute() external {
        require(amountSet, "fixed amount not set");
        require(!refundOpen, "refund window open");
        require(isMember[msg.sender], "not a member");
        require(!contributed[round][msg.sender], "already contributed");
        contributed[round][msg.sender] = true;
        contributionsThisRound += 1;

        euint64 moved = _pull(msg.sender, _fixedAmount);
        _paid[round][msg.sender] = moved;
        FHE.allowThis(_paid[round][msg.sender]);
        FHE.allow(_paid[round][msg.sender], msg.sender);

        _pot = FHE.add(_pot, moved);
        FHE.allowThis(_pot);
        FHE.makePubliclyDecryptable(_pot); // pot total is visible for accountability; gifts are not
        emit Contributed(msg.sender, round);
    }

    /// @notice Open a refund window (organizer). Pauses contributions and payout so
    ///         members can reclaim this round's contribution (crisis / non-compliance).
    function openRefund() external {
        require(msg.sender == organizer, "only organizer");
        require(!refundOpen, "already open");
        refundOpen = true;
        emit RefundOpened(round);
    }

    /// @notice Close the refund window (organizer). Members who refunded may
    ///         contribute again. Not allowed once the circle is dissolved.
    function closeRefund() external {
        require(msg.sender == organizer, "only organizer");
        require(refundOpen, "not open");
        require(!dissolved, "dissolved");
        refundOpen = false;
        emit RefundClosed(round);
    }

    /// @notice Permanently wind down the circle (organizer). Opens refunds for good
    ///         and stops all further activity — a tombstone (selfdestruct is a no-op
    ///         under EIP-6780).
    function dissolve() external {
        require(msg.sender == organizer, "only organizer");
        _dissolve();
    }

    /// @notice Vote to dissolve. When every member has approved, the circle dissolves
    ///         on its own — "refund everyone if all agree".
    function approveDissolve() external {
        require(isMember[msg.sender], "not a member");
        require(!dissolved, "dissolved");
        require(!dissolveApproved[msg.sender], "already approved");
        dissolveApproved[msg.sender] = true;
        dissolveApprovals += 1;
        emit DissolveApproved(msg.sender, dissolveApprovals, members.length);
        if (dissolveApprovals == members.length) {
            _dissolve();
        }
    }

    function _dissolve() internal {
        require(!dissolved, "dissolved");
        dissolved = true;
        refundOpen = true; // everyone can reclaim their current contribution
        emit Dissolved();
        emit RefundOpened(round);
    }

    /// @notice Reclaim your own contribution for the current round while the
    ///         refund window is open (pull model, CEI-ordered).
    function claimRefund() external {
        require(refundOpen, "refund window closed");
        require(contributed[round][msg.sender], "nothing to refund");
        require(!refunded[round][msg.sender], "already refunded");

        euint64 amount = _paid[round][msg.sender];
        refunded[round][msg.sender] = true;
        contributed[round][msg.sender] = false;
        contributionsThisRound -= 1;
        _pot = FHE.sub(_pot, amount);
        FHE.allowThis(_pot);
        FHE.makePubliclyDecryptable(_pot); // pot total is visible for accountability; gifts are not

        _push(msg.sender, amount);
        emit Refunded(msg.sender, round);
    }

    /// @notice Pay the encrypted pot to this round's recipient, then rotate.
    /// @dev Requires every member to have contributed this round.
    function payout() external {
        require(!refundOpen, "refund window open");
        require(contributionsThisRound == members.length, "round not complete");
        address recipient = members[round % members.length];

        _push(recipient, _pot);
        emit PaidOut(recipient, round);

        round += 1;
        contributionsThisRound = 0;
        _pot = FHE.asEuint64(0);
        FHE.allowThis(_pot);
        FHE.makePubliclyDecryptable(_pot); // pot total is visible for accountability; gifts are not
    }

    function memberCount() external view returns (uint256) {
        return members.length;
    }

    /// @notice Handle of the fixed contribution amount (decryptable by members).
    function fixedAmountHandle() external view returns (euint64) {
        return _fixedAmount;
    }

    /// @notice Handle of this round's pot total (publicly decryptable — accountability).
    function potTotalHandle() external view returns (bytes32) {
        return FHE.toBytes32(_pot);
    }

    /// @notice Handle of the caller's paid amount this round (decryptable by them).
    function paidOf(uint256 round_, address who) external view returns (euint64) {
        return _paid[round_][who];
    }
}
