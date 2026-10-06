# mint-check

![Tests](https://github.com/switch-afk/mint-check/actions/workflows/test.yml/badge.svg)

Check a Solana token mint for red flags before you buy: who can mint more, who can freeze your tokens, and how concentrated the holders are.

## Checks

- Mint info: supply, decimals, token program and Token-2022 extensions
- Mint authority: can the creator still print more tokens?
- Freeze authority: can the creator freeze your token account?
- Risky Token-2022 extensions
- Holder concentration: how much of the supply sits in the top wallets
- `--json` output and exit codes for scripting
- Zero dependencies, offline test suite, CI on every PR

## Quick start

Run it straight from GitHub, no install needed:

```bash
npx github:switch-afk/mint-check <mint-address>
```

Or install it globally:

```bash
npm install -g github:switch-afk/mint-check
mint-check <mint-address>
```

Or clone it:

```bash
git clone https://github.com/switch-afk/mint-check.git
cd mint-check
node bin/mint-check.js <mint-address>
```

Requires Node.js 18 or newer. The examples below use `mint-check`. If you cloned the repo, use `node bin/mint-check.js` instead.

## Example

```
Mint        <mint address>
Program     Token-2022
Supply      972,401,166.83
Decimals    6
Extensions  metadataPointer, tokenMetadata
RPC         your-rpc-host.example

Checks
  [OK]      Mint authority revoked
            Nobody can create more tokens, so the supply is fixed.
  [OK]      Freeze authority revoked
            Nobody can freeze your token account.
  [OK]      Largest holder owns 13.48% of the supply
            No single wallet dominates the supply.
  [OK]      Top 10 holders own 24.75% of the supply
            The supply is spread across more wallets.

Top holders (largest 20 token accounts, grouped by owner)
  #   Owner                                         Share   Amount
  --  --------------------------------------------  ------  ------------------
  1   <owner address>                               13.48%  131,160,410.02
  2   <owner address>                               1.82%   17,773,343.82
  ...

  Top 1: 13.48%   Top 5: 20.08%   Top 10: 24.75%

Result: no red flags found in the authority and holder checks
```

### What the checks mean

| Finding | Level | Why it matters |
| --- | --- | --- |
| Mint authority active | warn | The creator can print more tokens and dilute holders |
| Freeze authority active | warn | The creator can freeze a holder's token account |
| Permanent delegate | danger | One address can move or burn tokens from any holder's account |
| Transfer hook | warn | A custom program runs on every transfer and can block it |
| Transfer fee | warn | Every transfer is charged a fee that the authority can change |
| Pausable | warn | A pause authority can halt all transfers |
| Non-transferable | warn | Tokens cannot be moved between wallets |
| Default account state frozen | warn | New holders start frozen until thawed |
| Mint close authority | info | The mint can be closed once supply is zero |
| Largest holder 20% or more | warn | One wallet controls a big share of the supply |
| Top 10 holders 80% or more | warn | A few wallets control almost everything |

Many legitimate tokens, such as stablecoins, keep some of these powers on purpose. The tool shows what the token allows, not what its creator intends. It is not financial advice.

### About the holder check

- It looks at the 20 largest token accounts and groups them by owner wallet, so one wallet with several accounts counts once.
- Tokens in the burn address are shown as **Burned**, not as a holder.
- A large holder is often a liquidity pool, a bonding curve (for example a token still on pump.fun), an exchange or a locked vault, not a person. The tool cannot tell these apart, so concentration is always a **warning**, never a danger. Open the owner address on a block explorer to find out what it is.
- Percentages are shares of the total supply.
- **Very large tokens cannot be holder-checked.** RPC providers refuse to list the largest accounts of tokens with millions of token accounts, such as USDC. In that case the tool says so, skips the holder check, and the result covers the authority checks only. In the JSON report, `checksRun` shows which checks actually ran.

### JSON output

Add `--json` to print the whole report as JSON and nothing else:

```bash
mint-check <mint-address> --json
```

```json
{
  "mint": "...",
  "program": "SPL Token",
  "supply": "7,850,307,604.171513",
  "supplyRaw": "7850307604171513",
  "decimals": 6,
  "mintAuthority": "...",
  "freezeAuthority": "...",
  "extensions": [],
  "rpc": "your-rpc-host.example",
  "checksRun": ["authority", "holders"],
  "holders": {
    "sampledAccounts": 20,
    "ownersResolved": true,
    "top1": 13.48,
    "top5": 20.08,
    "top10": 24.75,
    "burnedPercent": 0,
    "top": [{ "owner": "...", "accounts": 1, "amount": "131,160,410.02", "percent": 13.48 }]
  },
  "findings": [{ "id": "mint-authority", "level": "warn", "title": "...", "detail": "..." }],
  "summary": { "ok": 2, "info": 0, "warn": 2, "danger": 0, "level": "warn" },
  "result": "warn"
}
```

If the holder lookup fails, `checksRun` is `["authority"]` and `holders` contains an `error` message instead of the numbers.

### Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Finished. The `--fail-on` level, if given, was not reached |
| 1 | Bad input or the lookup failed |
| 2 | The result reached the `--fail-on` level |

Use `--fail-on warn` or `--fail-on danger` in scripts and CI:

```bash
mint-check <mint-address> --fail-on danger || echo "do not touch this token"
```

### Using your own RPC

The public mainnet RPC is heavily rate limited, and the holder check in particular often gets `HTTP 429`. Rate-limited requests are retried twice, but for regular use you should bring your own endpoint (free tiers from RPC providers work). Pass `-r` or set an environment variable, which keeps API keys out of your shell history:

```bash
export MINT_CHECK_RPC="https://your-rpc-url"
mint-check <mint-address>
```

Only the RPC hostname is ever printed, never the full URL, so API keys stay private.

### Options

| Option | Description | Default |
| --- | --- | --- |
| `-r, --rpc <url>` | RPC endpoint | `MINT_CHECK_RPC` or public mainnet |
| `-t, --timeout <ms>` | Timeout per request | 5000 |
| `--json` | Print the report as JSON only | off |
| `--fail-on <level>` | Exit with code 2 when the result reaches `warn` or `danger` | off |
| `-h, --help` | Show help | |
| `-v, --version` | Show version | |

## Development

Run the test suite (no network needed, tests use local fake RPC servers):

```bash
npm test
```

Tests run automatically on every pull request through GitHub Actions.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and ideas.

## License

MIT