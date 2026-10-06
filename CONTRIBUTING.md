# Contributing

Thanks for helping out. This project is small on purpose, and every contribution is welcome, even a typo fix.

## Setup

```bash
git clone https://github.com/switch-afk/mint-check.git
cd mint-check
npm test
```

Requires Node.js 18 or newer. There are no dependencies to install.

## Workflow

1. Fork the repo and create a branch from `main`.
2. Make your change. Add or update tests in `tests/` when behavior changes.
3. Run `npm test`. Tests use local fake RPC servers, so no network is needed.
4. Open a pull request with a short description of what and why.

## Ideas

- Detect well-known liquidity pools and bonding curves, so the holder check can label them
- Check Metaplex token metadata (is it mutable, who is the update authority)
- Show the creator wallet and how old the token is
- More Token-2022 extensions (confidential transfers, interest-bearing)
- A fallback for very large tokens that cannot list their largest accounts
- Read several mints from a file and print one summary table

Open an issue first if you want to discuss a bigger change.

## Style

- Plain modern JavaScript (ES modules), no build step.
- Never print full RPC URLs. They often contain API keys, so print the hostname only.
- Keep checks honest: this tool shows what a token allows, not what its creator intends.