# mint-check

![Tests](https://github.com/switch-afk/mint-check/actions/workflows/test.yml/badge.svg)

Check a Solana token mint for red flags before you buy: who can mint more, who can freeze your tokens, and how concentrated the holders are.

> Status: early development. Checks are landing one PR at a time.

## Planned checks

- [ ] Mint info: supply, decimals and which token program the mint uses
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

Right now the tool only validates the address you give it.

## Development

```bash
npm test
```

Tests run automatically on every pull request through GitHub Actions.

## License

MIT