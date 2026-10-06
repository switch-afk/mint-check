import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkHolders, summarize, verdictLine } from '../src/checks.js';

const OWNER = 'Owner111111111111111111111111111111111111111';

function makeResult({ top1, top10 }) {
  return {
    ok: true,
    sampledAccounts: 20,
    ownersResolved: true,
    burnedPercent: 0,
    top1,
    top5: top10,
    top10,
    holders: [
      { owner: OWNER, accounts: 1, amountRaw: '1', amount: '1', percent: top1 },
    ],
  };
}

const levels = (findings) => findings.map((f) => f.level);

test('a dominant holder and a concentrated top 10 are both warnings', () => {
  const findings = checkHolders(makeResult({ top1: 45, top10: 90 }));

  assert.deepEqual(levels(findings), ['warn', 'warn']);
  assert.ok(findings[0].title.includes('45.00%'));
  assert.ok(findings[0].detail.includes(OWNER));
  assert.ok(findings[0].detail.includes('liquidity pool'));
  assert.ok(findings[1].title.includes('90.00%'));
});

test('a spread-out supply is reported as ok', () => {
  const findings = checkHolders(makeResult({ top1: 5, top10: 30 }));

  assert.deepEqual(levels(findings), ['ok', 'ok']);
});

test('the two thresholds are checked separately', () => {
  const findings = checkHolders(makeResult({ top1: 5, top10: 85 }));

  assert.deepEqual(levels(findings), ['ok', 'warn']);
});

test('the exact threshold values count as warnings', () => {
  const findings = checkHolders(makeResult({ top1: 20, top10: 80 }));

  assert.deepEqual(levels(findings), ['warn', 'warn']);
});

test('no holders gives a single info finding', () => {
  const findings = checkHolders({
    ok: true,
    sampledAccounts: 0,
    ownersResolved: true,
    burnedPercent: 0,
    top1: 0,
    top5: 0,
    top10: 0,
    holders: [],
  });

  assert.deepEqual(levels(findings), ['info']);
  assert.equal(findings[0].id, 'holders');
});

test('verdictLine names the scope when nothing was flagged', () => {
  const clean = summarize(checkHolders(makeResult({ top1: 5, top10: 30 })));

  assert.equal(
    verdictLine(clean, 'authority and holder checks'),
    'Result: no red flags found in the authority and holder checks'
  );
  assert.equal(
    verdictLine(clean),
    'Result: no red flags found in the authority checks'
  );
});

test('verdictLine counts holder warnings in the caution result', () => {
  const caution = summarize(checkHolders(makeResult({ top1: 45, top10: 30 })));

  assert.equal(
    verdictLine(caution, 'authority and holder checks'),
    'Result: CAUTION (1 warning)'
  );
});