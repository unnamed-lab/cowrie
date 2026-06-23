// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";

/// @title ConfidentialPoolBase
/// @notice Shared core for every Cowrie mode: holds the confidential token
///         reference, pulls encrypted contributions in, pushes encrypted payouts
///         out, and centralizes ACL handling. Modes (Circles / Streams / Pools)
///         extend this and supply their own trigger logic.
/// @dev Funds never live in a bespoke ledger — the pool operates on an existing
///      ERC-7984 token. Members approve the pool as an operator via
///      `token.setOperator(pool, until)`; the pool then moves funds with
///      `confidentialTransferFrom` (pull) and `confidentialTransfer` (push).
abstract contract ConfidentialPoolBase is ZamaEthereumConfig {
    /// @notice The confidential ERC-7984 token this pool moves.
    IERC7984 public immutable token;
    /// @notice The address allowed to run privileged actions (fund/configure).
    address public organizer;

    constructor(address token_, address organizer_) {
        require(token_ != address(0) && organizer_ != address(0), "zero addr");
        token = IERC7984(token_);
        organizer = organizer_;
    }

    modifier onlyOrganizer() {
        require(msg.sender == organizer, "not organizer");
        _;
    }

    /// @dev Turn a client-encrypted input into a usable ciphertext handle and
    ///      grant this contract permission to operate on it.
    function _ingest(externalEuint64 enc, bytes calldata proof) internal returns (euint64 amount) {
        amount = FHE.fromExternal(enc, proof);
        FHE.allowThis(amount);
    }

    /// @dev Pull `amount` from `from` into this pool. `from` MUST have called
    ///      `token.setOperator(address(this), until)` first. Returns the amount
    ///      actually moved (ERC-7984 caps at the available balance instead of
    ///      reverting, to avoid leaking balances) — always use `moved`.
    function _pull(address from, euint64 amount) internal returns (euint64 moved) {
        FHE.allowTransient(amount, address(token)); // token must read the handle
        moved = token.confidentialTransferFrom(from, address(this), amount);
        FHE.allowThis(moved);
    }

    /// @dev Push `amount` from the pool to `to`. Returns the amount actually moved.
    function _push(address to, euint64 amount) internal returns (euint64 moved) {
        FHE.allowTransient(amount, address(token));
        moved = token.confidentialTransfer(to, amount);
    }
}
