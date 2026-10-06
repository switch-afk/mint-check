#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { isValidAddress } from '../src/address.js';
import { DEFAULT_RPC, hostLabel, rateLimitHint } from '../src/rpc.js';
import { fetchMintInfo } from '../src/mint.js';
import { fetchTopHolders, renderHolders } from '../src/holders.js';
import { renderFindings, verdictLine } from '../src/checks.js';
import { buildReport, shouldFail } from '../src/report.js';

const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
);

const HELP = `
mint-check v${pkg.version}
Check a Solana token mint for red flags.

Usage:
  mint-check <mint-address> [options]

Options:
  -r, --rpc <url>        RPC endpoint (default ${DEFAULT_RPC})
  -t, --timeout <ms>     Timeout per request in ms (default 5000)
      --json             Print the report as JSON only
      --fail-on <level>  Exit with code 2 if the result reaches this level
                         (warn or danger)
  -h, --help             Show this help
  -v, --version          Show the version

Exit codes:
  0  finished, and the --fail-on level (if given) was not reached
  1  bad input or the lookup failed
  2  the result reached the --fail-on level

You can also set the RPC with the MINT_CHECK_RPC environment variable,
which keeps API keys out of your shell history.

Only the RPC hostname is ever printed, never the full URL.

Examples:
  mint-check EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
  mint-check <mint-address> --json
  mint-check <mint-address> --fail-on warn
`;

function fail(message) {
  console.error(message);
  console.error('Run with --help to see what is available.');
  process.exit(1);
}

function printError(message) {
  console.error(message);
  const hint = rateLimitHint(message);
  if (hint) console.error(hint);
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
  const opts = {
    rpc: null,
    timeout: 5000,
    json: false,
    failOn: null,
    help: false,
    version: false,
  };
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') opts.help = true;
    else if (arg === '-v' || arg === '--version') opts.version = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--fail-on') opts.failOn = argv[++i];
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

if (opts.failOn !== null && !['warn', 'danger'].includes(opts.failOn)) {
  fail('--fail-on must be "warn" or "danger"');
}

const rpcUrl = opts.rpc ?? process.env.MINT_CHECK_RPC ?? DEFAULT_RPC;

if (!validUrl(rpcUrl)) fail('Invalid RPC URL.');

const info = await fetchMintInfo(mint, rpcUrl, opts.timeout);

if (!info.ok) {
  printError(info.error);
  process.exit(1);
}

const holders = await fetchTopHolders(info, rpcUrl, opts.timeout);
const report = buildReport(info, holders, hostLabel(rpcUrl));

if (opts.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const rows = [
    ['Mint', info.mint],
    ['Program', info.programName],
    ['Supply', info.supply],
    ['Decimals', String(info.decimals)],
  ];

  if (info.extensions.length > 0) {
    rows.push(['Extensions', info.extensions.join(', ')]);
  }

  rows.push(['RPC', report.rpc]);

  printRows(rows);

  console.log('\nChecks');
  console.log(renderFindings(report.findings));

  if (holders.ok) {
    console.log(`\n${renderHolders(holders)}`);
  } else {
    console.log(`\nHolder check unavailable. ${holders.error}`);
    const hint = rateLimitHint(holders.error);
    if (hint) console.log(hint);
  }

  const scope = holders.ok ? 'authority and holder checks' : 'authority checks';
  console.log(`\n${verdictLine(report.summary, scope)}`);
  console.log(
    '\nThese checks show what the token allows, not what its creator intends. Not financial advice.'
  );
}

if (shouldFail(report.result, opts.failOn)) process.exitCode = 2;