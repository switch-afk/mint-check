# mint-check

![Tests](https://github.com/switch-afk/mint-check/actions/workflows/test.yml/badge.svg)

Check a Solana token mint for red flags before you buy: who can mint more, who can freeze your tokens, and how concentrated the holders are.

> Status: early development. Checks are landing one PR at a time.

## Checks

- [x] Mint info: supply, decimals, token program and Token-2022 extensions
- [ ] Mint authority: can the creator still print more tokens?
- [ ] Freeze authority: can the creator freeze your token account?
- [ ] Holder concentration: how much of the supply sits in the top accounts
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
```

Token-2022 mints also list their extensions, such as `transferFeeConfig` or `permanentDelegate`.

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