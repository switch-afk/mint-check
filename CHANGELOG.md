# Changelog

## 0.2.0

- Run it with `npx github:switch-afk/mint-check <mint-address>`, no clone needed
- Clear explanation when an RPC refuses to list the largest accounts of a very large token such as USDC
- Added `CONTRIBUTING.md` with contribution ideas

## 0.1.0

- Mint info: supply, decimals, token program and Token-2022 extensions
- Mint authority and freeze authority checks with plain-English verdicts
- Warnings for risky Token-2022 extensions such as permanent delegate, transfer hook and transfer fee
- Holder concentration: top holders grouped by owner wallet, burned tokens set aside
- `--json` output and `--fail-on warn|danger` exit codes for scripts
- Rate-limited (HTTP 429) requests are retried, with a hint to use your own RPC
- Only the RPC hostname is printed, never the full URL
- Offline test suite and GitHub Actions CI