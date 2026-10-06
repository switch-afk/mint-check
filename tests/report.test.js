import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, shouldFail } from '../src/report.js';

const AUTHORITY = 'Auth111111111111111111111111111111111111111';
const MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const INFO = {
  mint: MINT,
  programName: 'SPL Token',
  supply: '1,000',
  supplyRaw: '1000000000',
  decimals: 6,
  mintAuthority: null,
  freezeAuthority: AUTHORITY,
  extensions: [],
  extensionDetails: [],
};

function makeHolders(count = 12) {
  return {
    ok: true,
    sampledAccounts: 20,
    ownersResolved: true,
    burnedPercent: 1.5,
    top1: 45,
    top5: 60,
    top10: 70,
    holders: Array.from({ length: count }, (_, i) => ({
      owner: `Owner${i}`,
      accounts: 1,
      amountRaw: '100',
      amount: '100',
      percent: 5,
    })),
  };
}

test('buildReport combines the checks into one report', () => {
  const report = buildReport(INFO, makeHolders(), 'rpc.example.com');

  assert.equal(report.mint, MINT);
  assert.equal(report.program, 'SPL Token');
  assert.equal(report.decimals, 6);
  assert.equal(report.mintAuthority, null);
  assert.equal(report.freezeAuthority, AUTHORITY);
  assert.equal(report.rpc, 'rpc.example.com');
  assert.deepEqual(report.checksRun, ['authority', 'holders']);

  // freeze authority active + largest holder 45% = 2 warnings
  assert.equal(report.result, 'warn');
  assert.equal(report.summary.warn, 2);
  assert.equal(report.summary.level, 'warn');

  assert.equal(report.holders.top1, 45);
  assert.equal(report.holders.burnedPercent, 1.5);
  assert.equal(report.holders.top.length, 10);
  assert.deepEqual(Object.keys(report.holders.top[0]), [
    'owner',
    'accounts',
    'amount',
    'percent',
  ]);

  assert.deepEqual(Object.keys(report.findings[0]), [
    'id',
    'level',
    'title',
    'detail',
  ]);
});

test('buildReport still works when the holder lookup failed', () => {
  const report = buildReport(
    INFO,
    { ok: false, error: 'Holder lookup failed: HTTP 429' },
    'rpc.example.com'
  );

  assert.deepEqual(report.checksRun, ['authority']);
  assert.equal(report.holders.error, 'Holder lookup failed: HTTP 429');
  assert.equal(report.findings.length, 2);
  assert.equal(report.result, 'warn');
});

test('buildReport reports ok when nothing is flagged', () => {
  const report = buildReport(
    { ...INFO, freezeAuthority: null },
    { ...makeHolders(3), top1: 5, top5: 12, top10: 12 },
    'rpc.example.com'
  );

  assert.equal(report.result, 'ok');
  assert.equal(report.summary.warn, 0);
  assert.equal(report.summary.danger, 0);
});

test('shouldFail compares the result level with the threshold', () => {
  assert.equal(shouldFail('ok', 'warn'), false);
  assert.equal(shouldFail('warn', 'warn'), true);
  assert.equal(shouldFail('warn', 'danger'), false);
  assert.equal(shouldFail('danger', 'danger'), true);
  assert.equal(shouldFail('danger', 'warn'), true);
  assert.equal(shouldFail('danger', null), false);
});