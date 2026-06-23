// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";

/// @title ConfidentialUSDT
/// @notice Demo ERC-7984 confidential USD token with an open faucet (testnet only).
/// @dev The faucet amount is passed in clear because it is a faucet; balances and
///      subsequent transfers stay encrypted. Use a confidential mint for
///      privacy-from-genesis in production.
contract ConfidentialUSDT is ZamaEthereumConfig, ERC7984 {
    constructor() ERC7984("Confidential USDT", "cUSDT", "") {}

    /// @notice Mint yourself test funds. Anyone can call (testnet faucet).
    /// @param amount Clear amount to mint to the caller.
    function faucet(uint64 amount) external {
        _mint(msg.sender, FHE.asEuint64(amount));
    }
}
