# @cowrie/contracts

FHEVM smart contracts for **Cowrie — Confidential Group Treasury**. See the
[root README](../../README.md) for the full project overview and deployed addresses.

## Contracts

- `base/ConfidentialPoolBase.sol` — shared core: holds the ERC-7984 token, centralizes ACL,
  and the encrypted pull (`_pull`) / push (`_push`) rails.
- `modes/SavingsCircle.sol` — rotating savings (ROSCA). Organizer-set encrypted fixed amount,
  equal contributions, rotating pot, refund window, and dissolve (organizer or unanimous vote).
- `modes/PayrollStreams.sol` — confidential payroll. Encrypted salaries, period-gated claims,
  funded/collected totals, `removeEmployee`, and `stopAndReclaim`.
- `modes/Crowdfund.sol` — crowdfunding. Encrypted contributions, public running total, and a
  single goal-reached boolean revealed via self-relay public decryption.
- `modes/*Factory.sol` — per-mode deployers + registries (titles/descriptions, 0.005 ETH
  anti-spam stake on campaigns/streams, owner-withdrawable).
- `mocks/ConfidentialUSDT.sol` — ERC-7984 test token with an open faucet.

## Commands

```bash
pnpm compile        # compile + typechain
pnpm test           # 21 tests on the FHEVM mock runtime
pnpm deploy:sepolia # deploy token + three factories
```

Set secrets in `.env` (gitignored): `MNEMONIC`, `SEPOLIA_RPC_URL`, optional `ETHERSCAN_API_KEY`.
Gas price is capped via `SEPOLIA_GAS_PRICE` (default 1 gwei).

## License

BSD-3-Clause-Clear.
