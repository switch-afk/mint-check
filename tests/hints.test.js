import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errorHint, tooManyAccountsHint } from '../src/rpc.js';

const HELIUS_STYLE =
  'Holder lookup failed: Too many accounts requested (10000000 pubkeys), try adding filters to narrow down results';

test('tooManyAccountsHint explains the limit for very large tokens', () => {
  const hint = tooManyAccountsHint(HELIUS_STYLE);

  assert.ok(hint.includes('too many holders'));
  assert.ok(hint.includes('USDC'));
});

test('tooManyAccountsHint ignores other errors', () => {
  assert.equal(tooManyAccountsHint('Holder lookup failed: HTTP 429'), '');
  assert.equal(tooManyAccountsHint('fetch failed'), '');
  assert.equal(tooManyAccountsHint(undefined), '');
});

test('errorHint picks the matching hint', () => {
  assert.ok(errorHint('Holder lookup failed: HTTP 429').includes('MINT_CHECK_RPC'));
  assert.ok(errorHint(HELIUS_STYLE).includes('too many holders'));
});

test('errorHint is empty for errors it does not know', () => {
  assert.equal(errorHint('RPC request failed: fetch failed'), '');
  assert.equal(errorHint('Account not found. Check the address and the network.'), '');
});