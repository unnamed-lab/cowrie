// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ConfidentialPoolBase} from "../base/ConfidentialPoolBase.sol";

/// @title Crowdfund (confidential crowdfunding / Pools)
/// @notice Contributions accumulate encrypted; the only thing ever revealed is a
///         single boolean — whether the encrypted total reached the public goal.
///         Individual contributions are never revealed. On success the
///         beneficiary withdraws; on failure contributors self-refund their own
///         encrypted amounts.
/// @dev Reveal uses the self-relay PUBLIC DECRYPTION flow of @fhevm/solidity
///      0.11.x (there is no decryption oracle):
///        1. `finalize()` computes `reached = total >= goal` and marks it publicly
///           decryptable, then emits its handle.
///        2. Off-chain, a client fetches the cleartext + KMS proof for that handle
///           via the relayer SDK `publicDecrypt([handle])`.
///        3. `settle(cleartexts, proof)` verifies them with `FHE.checkSignatures`
///           and flips the state machine — trustlessly, by anyone.
contract Crowdfund is ConfidentialPoolBase {
    /// @notice Human-readable campaign title (what people are funding).
    string public title;
    /// @notice Human-readable description (why — the cause / details).
    string public description;
    /// @notice Public campaign target (the goal is a public term; the running total is not).
    uint64 public immutable goal;
    /// @notice Public deadline after which the campaign can be finalized.
    uint256 public immutable deadline;
    /// @notice Who receives the funds if the goal is reached.
    address public immutable beneficiary;

    enum State {
        Active,
        Deciding,
        Succeeded,
        Failed
    }
    State public state;

    euint64 private _total;
    mapping(address => euint64) private _contribution;
    ebool private _reached; // set in finalize(), verified in settle()

    event Contributed(address indexed who);
    event Finalizing(bytes32 reachedHandle);
    event Finalized(bool reached);

    constructor(
        address token_,
        address organizer_,
        address beneficiary_,
        uint64 goal_,
        uint256 duration_,
        string memory title_,
        string memory description_
    ) ConfidentialPoolBase(token_, organizer_) {
        require(beneficiary_ != address(0), "zero beneficiary");
        beneficiary = beneficiary_;
        goal = goal_;
        deadline = block.timestamp + duration_;
        title = title_;
        description = description_;
        _total = FHE.asEuint64(0);
        FHE.allowThis(_total);
        FHE.makePubliclyDecryptable(_total); // running total (progress) is public; individual gifts are not
    }

    /// @notice Contribute an encrypted amount before the deadline.
    /// @dev Caller must have approved this campaign as an ERC-7984 operator.
    function contribute(externalEuint64 enc, bytes calldata proof) external {
        require(state == State.Active && block.timestamp < deadline, "closed");
        euint64 amount = _ingest(enc, proof);
        euint64 moved = _pull(msg.sender, amount);

        _contribution[msg.sender] = FHE.add(_contribution[msg.sender], moved);
        FHE.allowThis(_contribution[msg.sender]);
        FHE.allow(_contribution[msg.sender], msg.sender); // contributor decrypts their own total

        _total = FHE.add(_total, moved);
        FHE.allowThis(_total);
        FHE.makePubliclyDecryptable(_total); // progress is public; who-gave-what is not
        emit Contributed(msg.sender);
    }

    /// @notice After the deadline, compute and publish ONLY whether the goal was met.
    /// @dev Emits the handle to publicly decrypt off-chain and submit to `settle`.
    function finalize() external {
        require(state == State.Active && block.timestamp >= deadline, "not yet");
        ebool reached = FHE.ge(_total, FHE.asEuint64(goal));
        FHE.allowThis(reached);
        FHE.makePubliclyDecryptable(reached);
        _reached = reached;
        state = State.Deciding;
        emit Finalizing(FHE.toBytes32(reached));
    }

    /// @notice Submit the publicly-decrypted result of `finalize()` to flip the
    ///         campaign into Succeeded / Failed. Callable by anyone with a valid
    ///         KMS-signed decryption.
    /// @param cleartexts ABI-encoded decrypted values from `publicDecrypt`.
    /// @param decryptionProof KMS signatures proving the decryption.
    function settle(bytes memory cleartexts, bytes memory decryptionProof) external {
        require(state == State.Deciding, "not deciding");
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(_reached);
        FHE.checkSignatures(handles, cleartexts, decryptionProof);
        bool reached = abi.decode(cleartexts, (bool));
        state = reached ? State.Succeeded : State.Failed;
        emit Finalized(reached);
    }

    /// @notice On success, send the whole encrypted balance to the beneficiary.
    function release() external {
        require(state == State.Succeeded, "not succeeded");
        _push(beneficiary, token.confidentialBalanceOf(address(this)));
    }

    /// @notice On failure, refund the caller's own encrypted contribution (CEI).
    function refund() external {
        require(state == State.Failed, "not failed");
        euint64 amount = _contribution[msg.sender];
        _contribution[msg.sender] = FHE.asEuint64(0);
        FHE.allowThis(_contribution[msg.sender]);
        _push(msg.sender, amount);
    }

    /// @notice The caller's encrypted contribution handle (decryptable only by them).
    function contributionOf(address who) external view returns (euint64) {
        return _contribution[who];
    }

    /// @notice Handle of the goal-reached boolean (valid once `finalize()` ran).
    function reachedHandle() external view returns (bytes32) {
        return FHE.toBytes32(_reached);
    }

    /// @notice Handle of the running total raised (publicly decryptable — campaign progress).
    function totalRaisedHandle() external view returns (bytes32) {
        return FHE.toBytes32(_total);
    }
}
