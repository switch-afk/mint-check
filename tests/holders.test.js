import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BURN_ADDRESS,
  fetchTopHolders,
  percentOf,
  renderHolders,
} from '../src/holders.js';
import { startMockRpc } from './helpers/mock-rpc.js';

const MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const OWNER_A = 'OwnerA11111111111111111111111111111111111111';
const OWNER_B = 'OwnerB11111111111111111111111111111111111111';

const INFO = { mint: MINT, supplyRaw: '1000', decimals: 0 };

const ACCOUNTS = [
  { address: 'TokA1', amount: '500' },
  { address: 'TokA2', amount: '100' },
  { address: 'TokB1', amount: '200' },
  { address: 'TokBurn', amount: '50' },
];

function rpcError(payload, message) {
  return {
    body: {
      jsonrpc: '2.0',
      id: payload.id,
      error: { code: -32000, message },
    },
  };
}

test('percentOf computes shares with two decimals and handles zero supply', () => {
  assert.equal(percentOf('250', '1000'), 25);
  assert.equal(percentOf('1', '3'), 33.33);
  assert.equal(percentOf('5', '0'), 0);
});

test('fetchTopHolders groups token accounts by owner and sets burned tokens aside', async () => {
  const methods = [];
  const owners = [OWNER_A, OWNER_A, OWNER_B, BURN_ADDRESS];

  const server = await startMockRpc((payload) => {
    methods.push(payload.method);

    if (payload.method === 'getTokenLargestAccounts') {
      return { result: { context: { slot: 1 }, value: ACCOUNTS } };
    }

    if (payload.method === 'getMultipleAccounts') {
      assert.deepEqual(payload.params[0], ['TokA1', 'TokA2', 'TokB1', 'TokBurn']);
      return {
        result: {
          context: { slot: 1 },
          value: owners.map((owner) => ({
            data: { parsed: { info: { owner } } },
          })),
        },
      };
    }

    return rpcError(payload, 'Method not found');
  });

  try {
    const result = await fetchTopHolders(INFO, server.url);

    assert.deepEqual(methods, ['getTokenLargestAccounts', 'getMultipleAccounts']);
    assert.equal(result.ok, true);
    assert.equal(result.sampledAccounts, 4);
    assert.equal(result.ownersResolved, true);

    assert.equal(result.holders.length, 2);
    assert.equal(result.holders[0].owner, OWNER_A);
    assert.equal(result.holders[0].accounts, 2);
    assert.equal(result.holders[0].amountRaw, '600');
    assert.equal(result.holders[0].amount, '600');
    assert.equal(result.holders[0].percent, 60);
    assert.equal(result.holders[1].owner, OWNER_B);
    assert.equal(result.holders[1].percent, 20);

    assert.equal(result.burnedPercent, 5);
    assert.equal(result.top1, 60);
    assert.equal(result.top5, 80);
    assert.equal(result.top10, 80);
  } finally {
    await server.close();
  }
});

test('fetchTopHolders falls back to token accounts when owners cannot be resolved', async () => {
  const server = await startMockRpc((payload) => {
    if (payload.method === 'getTokenLargestAccounts') {
      return { result: { context: { slot: 1 }, value: ACCOUNTS } };
    }
    return rpcError(payload, 'boom');
  });

  try {
    const result = await fetchTopHolders(INFO, server.url);

    assert.equal(result.ok, true);
    assert.equal(result.ownersResolved, false);
    assert.equal(result.holders.length, 4);
    assert.equal(result.holders[0].owner, 'TokA1');
    assert.equal(result.holders[0].accounts, 1);
    assert.equal(result.top1, 50);
  } finally {
    await server.close();
  }
});

test('fetchTopHolders reports an RPC failure', async () => {
  const server = await startMockRpc((payload) =>
    rpcError(payload, 'Too many accounts')
  );

  try {
    const result = await fetchTopHolders(INFO, server.url);

    assert.equal(result.ok, false);
    assert.ok(result.error.includes('Holder lookup failed'));
    assert.ok(result.error.includes('Too many accounts'));
  } finally {
    await server.close();
  }
});

test('fetchTopHolders handles a token with no holders', async () => {
  const methods = [];
  const server = await startMockRpc((payload) => {
    methods.push(payload.method);
    return { result: { context: { slot: 1 }, value: [] } };
  });

  try {
    const result = await fetchTopHolders(
      { mint: MINT, supplyRaw: '0', decimals: 0 },
      server.url
    );

    assert.deepEqual(methods, ['getTokenLargestAccounts']);
    assert.equal(result.ok, true);
    assert.deepEqual(result.holders, []);
    assert.equal(result.top1, 0);
    assert.equal(result.burnedPercent, 0);
  } finally {
    await server.close();
  }
});

test('renderHolders prints the table, summary, burned share and a note', () => {
  const output = renderHolders({
    ok: true,
    sampledAccounts: 4,
    ownersResolved: false,
    burnedPercent: 5,
    top1: 60,
    top5: 80,
    top10: 80,
    holders: [
      { owner: OWNER_A, accounts: 2, amountRaw: '600', amount: '600', percent: 60 },
      { owner: OWNER_B, accounts: 1, amountRaw: '200', amount: '200', percent: 20 },
    ],
  });

  assert.ok(output.includes('Top holders (largest 4 token accounts'));
  assert.ok(output.includes(OWNER_A));
  assert.ok(output.includes('60.00%'));
  assert.ok(output.includes('Top 1: 60.00%'));
  assert.ok(output.includes('Top 10: 80.00%'));
  assert.ok(output.includes('Burned: 5.00%'));
  assert.ok(output.includes('could not be resolved'));
});