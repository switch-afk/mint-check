#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { isValidAddress } from '../src/address.js';
import { DEFAULT_RPC, hostLabel } from '../src/rpc.js';
import { fetchMintInfo } from '../src/mint.js';
import {
  checkMint,
  summarize,
  verdictLine,
  renderFindings,
} from '../src/checks.js';

const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
);

const HELP = `
mint-check v${pkg.version}
Check a Solana token mint for red flags.

Usage:
  mint-check <mint-address> [options]

Options:
  -r, --rpc <url>      RPC endpoint (default ${DEFAULT_RPC})
  -t, --timeout <ms>   Timeout per request in ms (default 5000)
  -h, --help           Show this help
  -v, --version        Show the version

You can also set the RPC with the MINT_CHECK_RPC environment variable,
which keeps API keys out of your shell history.

Only the RPC hostname is ever printed, never the full URL.

Example:
  mint-check EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
`;

function fail(message) {
  console.error(message);
  console.error('Run with --help to see what is available.');
  process.exit(1);
}

function validUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function parseArgs(argv) {
  const opts = { rpc: null, timeout: 5000, help: false, version: false };
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') opts.help = true;
    else if (arg === '-v' || arg === '--version') opts.version = true;
    else if (arg === '-r' || arg === '--rpc') opts.rpc = argv[++i];
    else if (arg === '-t' || arg === '--timeout') opts.timeout = Number(argv[++i]);
    else if (arg.startsWith('-')) fail(`Unknown option: ${arg}`);
    else positional.push(arg);
  }

  return { opts, positional };
}

function printRows(rows) {
  for (const [label, value] of rows) {
    console.log(`${label.padEnd(11)} ${value}`);
  }
}

const { opts, positional } = parseArgs(process.argv.slice(2));

if (opts.version) {
  console.log(pkg.version);
  process.exit(0);
}

if (opts.help || positional.length === 0) {
  console.log(HELP.trim());
  process.exit(0);
}

if (positional.length > 1) fail('Give exactly one mint address.');

const mint = positional[0];

if (!isValidAddress(mint)) {
  fail('That does not look like a valid Solana address.');
}

if (!Number.isFinite(opts.timeout) || opts.timeout <= 0) {
  fail('--timeout must be a positive number of milliseconds');
}

const rpcUrl = opts.rpc ?? process.env.MINT_CHECK_RPC ?? DEFAULT_RPC;

if (!validUrl(rpcUrl)) fail('Invalid RPC URL.');

const info = await fetchMintInfo(mint, rpcUrl, opts.timeout);

if (!info.ok) {
  console.error(info.error);
  process.exit(1);
}

const rows = [
  ['Mint', info.mint],
  ['Program', info.programName],
  ['Supply', info.supply],
  ['Decimals', String(info.decimals)],
];

if (info.extensions.length > 0) {
  rows.push(['Extensions', info.extensions.join(', ')]);
}

rows.push(['RPC', hostLabel(rpcUrl)]);

printRows(rows);

const findings = checkMint(info);

console.log('\nChecks');
console.log(renderFindings(findings));
console.log(`\n${verdictLine(summarize(findings))}`);
console.log(
  '\nThese checks show what the token allows, not what its creator intends. Not financial advice.'
);
console.log('The holder concentration check is coming in the next release.');