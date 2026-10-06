import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchMintInfo, formatAmount, TOKEN_PROGRAMS } from '../src/mint.js';
import { startMockRpc } from './helpers/mock-rpc.js';

const SPL_TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const AUTHORITY = 'Auth111111111111111111111111111111111111111';

function accountReply({ owner = SPL_TOKEN, program = 'spl-token', parsed }) {
  return {
    result: {
      context: { slot: 1 },
      value: {
        owner,
        lamports: 1461600,
        executable: false,
        data: { program, space: 82, parsed },
      },
    },
  };
}

function mintParsed(info = {}) {
  return {
    type: 'mint',
    info: {
      decimals: 6,
      freezeAuthority: null,
      isInitialized: true,
      mintAuthority: null,
      supply: '1000000000000',
      ...info,
    },
  };
}

test('formatAmount trims trailing zeros from the fraction', () => {
  assert.equal(formatAmount('1000000', 6), '1');
  assert.equal(formatAmount('1500000', 6), '1.5');
});

test('formatAmount adds thousands separators', () => {
  assert.equal(formatAmount('1234567890123', 6), '1,234,567.890123');
  assert.equal(formatAmount('1000000000000000', 6), '1,000,000,000');
});

test('formatAmount handles zero decimals, zero and tiny amounts', () => {
  assert.equal(formatAmount('5', 0), '5');
  assert.equal(formatAmount('0', 6), '0');
  assert.equal(formatAmount('1', 9), '0.000000001');
});

test('fetchMintInfo reads an SPL token mint', async () => {
  let seen = null;
  const server = await startMockRpc((payload) => {
    seen = payload;
    return accountReply({ parsed: mintParsed() });
  });

  try {
    const info = await fetchMintInfo(MINT, server.url);

    assert.equal(seen.method, 'getAccountInfo');
    assert.equal(seen.params[0], MINT);
    assert.equal(seen.params[1].encoding, 'jsonParsed');

    assert.equal(info.ok, true);
    assert.equal(info.programName, 'SPL Token');
    assert.equal(info.decimals, 6);
    assert.equal(info.supplyRaw, '1000000000000');
    assert.equal(info.supply, '1,000,000');
    assert.equal(info.mintAuthority, null);
    assert.equal(info.freezeAuthority, null);
    assert.deepEqual(info.extensions, []);
  } finally {
    await server.close();
  }
});

test('fetchMintInfo reports authorities when they are set', async () => {
  const server = await startMockRpc(() =>
    accountReply({
      parsed: mintParsed({ mintAuthority: AUTHORITY, freezeAuthority: AUTHORITY }),
    })
  );

  try {
    const info = await fetchMintInfo(MINT, server.url);

    assert.equal(info.ok, true);
    assert.equal(info.mintAuthority, AUTHORITY);
    assert.equal(info.freezeAuthority, AUTHORITY);
  } finally {
    await server.close();
  }
});

test('fetchMintInfo reads a Token-2022 mint and lists its extensions', async () => {
  const server = await startMockRpc(() =>
    accountReply({
      owner: TOKEN_2022,
      program: 'spl-token-2022',
      parsed: mintParsed({
        extensions: [
          { extension: 'transferFeeConfig', state: {} },
          { extension: 'permanentDelegate', state: { delegate: AUTHORITY } },
        ],
      }),
    })
  );

  try {
    const info = await fetchMintInfo(MINT, server.url);

    assert.equal(info.ok, true);
    assert.equal(info.programName, TOKEN_PROGRAMS[TOKEN_2022]);
    assert.deepEqual(info.extensions, ['transferFeeConfig', 'permanentDelegate']);
  } finally {
    await server.close();
  }
});

test('fetchMintInfo says when the account does not exist', async () => {
  const server = await startMockRpc(() => ({
    result: { context: { slot: 1 }, value: null },
  }));

  try {
    const info = await fetchMintInfo(MINT, server.url);

    assert.equal(info.ok, false);
    assert.ok(info.error.includes('not found'));
  } finally {
    await server.close();
  }
});

test('fetchMintInfo rejects a token account that is not a mint', async () => {
  const server = await startMockRpc(() =>
    accountReply({ parsed: { type: 'account', info: {} } })
  );

  try {
    const info = await fetchMintInfo(MINT, server.url);

    assert.equal(info.ok, false);
    assert.ok(info.error.includes('not a mint'));
  } finally {
    await server.close();
  }
});

test('fetchMintInfo rejects accounts owned by a non-token program', async () => {
  const server = await startMockRpc(() => ({
    result: {
      context: { slot: 1 },
      value: {
        owner: '11111111111111111111111111111111',
        lamports: 1,
        executable: false,
        data: ['', 'base64'],
      },
    },
  }));

  try {
    const info = await fetchMintInfo(MINT, server.url);

    assert.equal(info.ok, false);
    assert.ok(info.error.includes('not a token mint'));
  } finally {
    await server.close();
  }
});

test('fetchMintInfo reports RPC failures', async () => {
  const server = await startMockRpc(() => ({ status: 500, body: {} }));

  try {
    const info = await fetchMintInfo(MINT, server.url);

    assert.equal(info.ok, false);
    assert.ok(info.error.includes('HTTP 500'));
  } finally {
    await server.close();
  }
});