import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeBase58, isValidAddress } from '../src/address.js';

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const WSOL = 'So11111111111111111111111111111111111111112';
const SYSTEM_PROGRAM = '11111111111111111111111111111111';

test('decodeBase58 decodes small known values', () => {
  assert.deepEqual(Array.from(decodeBase58('2')), [1]);
  assert.deepEqual(Array.from(decodeBase58('z')), [57]);
  assert.deepEqual(Array.from(decodeBase58('21')), [58]);
});

test('decodeBase58 turns leading 1s into leading zero bytes', () => {
  assert.deepEqual(Array.from(decodeBase58('1')), [0]);
  assert.deepEqual(Array.from(decodeBase58('112')), [0, 0, 1]);
});

test('decodeBase58 returns null for invalid input', () => {
  assert.equal(decodeBase58(''), null);
  assert.equal(decodeBase58(null), null);
  assert.equal(decodeBase58('abc0'), null);
});

test('isValidAddress accepts real token mints', () => {
  assert.equal(isValidAddress(USDC), true);
  assert.equal(isValidAddress(WSOL), true);
});

test('isValidAddress accepts the system program address', () => {
  assert.equal(isValidAddress(SYSTEM_PROGRAM), true);
});

test('isValidAddress rejects characters outside the base58 alphabet', () => {
  assert.equal(isValidAddress(`0${USDC.slice(1)}`), false);
  assert.equal(isValidAddress(`O${USDC.slice(1)}`), false);
  assert.equal(isValidAddress(`I${USDC.slice(1)}`), false);
  assert.equal(isValidAddress(`l${USDC.slice(1)}`), false);
});

test('isValidAddress rejects empty, short and long input', () => {
  assert.equal(isValidAddress(''), false);
  assert.equal(isValidAddress('abc'), false);
  assert.equal(isValidAddress(`${USDC}A`), false);
});