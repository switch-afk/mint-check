# mint-check

![Tests](https://github.com/switch-afk/mint-check/actions/workflows/test.yml/badge.svg)

Check a Solana token mint for red flags before you buy: who can mint more, who can freeze your tokens, and how concentrated the holders are.

> Status: early development. Checks are landing one PR at a time.

## Checks

- [x] Mint info: supply, decimals, token program and Token-2022 extensions
- [x] Mint authority: can the creator still print more tokens?
- [x] Freeze authority: can the creator freeze your token account?
- [x] Risky Token-2022 extensions
- [x] Holder concentration: how much of the supply sits in the top wallets
- [ ] Readable report and `--json` output for scripting

## Requirements

- Node.js 18 or newer
- No dependencies

## Usage

```bash
git clone https://github.com/switch-afk/mint-check.git
cd mint-check
node bin/mint-check.js <mint-address>
```

Example:

```bash
node bin/mint-check.js EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

```
Mint        EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
Program     SPL Token
Supply      8,123,456,789.123456
Decimals    6
RPC         api.mainnet-beta.solana.com

Checks
  [WARN]    Mint authority is active
            <address> can create more tokens at any time. ...
  [WARN]    Freeze authority is active
            <address> can freeze any holder's token account, ...
  [OK]      Largest holder owns 4.20% of the supply
            No single wallet dominates the supply.
  [OK]      Top 10 holders own 18.75% of the supply
            The supply is spread across more wallets.

Top holders (largest 20 token accounts, grouped by owner)
  #  Owner                                         Share  Amount
  -  --------------------------------------------  -----  ---------------
  1  <owner address>                               4.20%  341,234,567.89
  ...

  Top 1: 4.20%   Top 5: 12.10%   Top 10: 18.75%

Result: CAUTION (2 warnings)
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

### Using your own RPC

The public mainnet RPC is rate limited. To use your own, pass `-r` or set an environment variable, which keeps API keys out of your shell history:

```bash
export MINT_CHECK_RPC="https://your-rpc-url"
node bin/mint-check.js <mint-address>
```

Only the RPC hostname is ever printed, never the full URL, so API keys stay private.

### Options

| Option | Description | Default |
| --- | --- | --- |
| `-r, --rpc <url>` | RPC endpoint | `MINT_CHECK_RPC` or public mainnet |
| `-t, --timeout <ms>` | Timeout per request | 5000 |
| `-h, --help` | Show help | |
| `-v, --version` | Show version | |

## Development

Run the test suite (no network needed, tests use local fake RPC servers):

```bash
npm test
```

Tests run automatically on every pull request through GitHub Actions.

## License

MIT