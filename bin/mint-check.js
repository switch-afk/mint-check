#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { isValidAddress } from '../src/address.js';

const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
);

const HELP = `
mint-check v${pkg.version}
Check a Solana token mint for red flags.

Usage:
  mint-check <mint-address> [options]

Options:
  -h, --help       Show this help
  -v, --version    Show the version

Example:
  mint-check EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

The checks themselves are landing one PR at a time.
`;

function fail(message) {
  console.error(message);
  console.error('Run with --help to see what is available.');
  process.exit(1);
}

const args = process.argv.slice(2);
const positional = [];
let help = false;
let version = false;

for (const arg of args) {
  if (arg === '-h' || arg === '--help') help = true;
  else if (arg === '-v' || arg === '--version') version = true;
  else if (arg.startsWith('-')) fail(`Unknown option: ${arg}`);
  else positional.push(arg);
}

if (version) {
  console.log(pkg.version);
  process.exit(0);
}

if (help || positional.length === 0) {
  console.log(HELP.trim());
  process.exit(0);
}

if (positional.length > 1) fail('Give exactly one mint address.');

const mint = positional[0];

if (!isValidAddress(mint)) {
  fail('That does not look like a valid Solana address.');
}

console.log(`Mint ${mint}`);
console.log('Checks are coming in the next releases.');