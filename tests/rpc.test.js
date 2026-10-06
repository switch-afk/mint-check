import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hostLabel, rpcCall, rateLimitHint } from '../src/rpc.js';
import { startMockRpc } from './helpers/mock-rpc.js';

const FAST = { retryDelayMs: 1 };

test('hostLabel keeps only the host and drops paths and API keys', () => {
  const label = hostLabel('https://rpc.example.com/v2/SECRETKEY?api-key=SECRET');

  assert.equal(label, 'rpc.example.com');
  assert.ok(!label.includes('SECRET'));
  assert.equal(hostLabel('not a url'), 'invalid-url');
});

test('rpcCall returns the result of a successful call', async () => {
  const server = await startMockRpc(() => ({ result: 123 }));
  try {
    const res = await rpcCall(server.url, 'getSlot');
    assert.equal(res.ok, true);
    assert.equal(res.result, 123);
  } finally {
    await server.close();
  }
});

test('rpcCall reports a JSON-RPC error message', async () => {
  const server = await startMockRpc((payload) => ({
    body: {
      jsonrpc: '2.0',
      id: payload.id,
      error: { code: -32005, message: 'Node is behind' },
    },
  }));
  try {
    const res = await rpcCall(server.url, 'getSlot');
    assert.equal(res.ok, false);
    assert.equal(res.error, 'Node is behind');
  } finally {
    await server.close();
  }
});

test('rpcCall reports HTTP errors', async () => {
  const server = await startMockRpc(() => ({ status: 500, body: {} }));
  try {
    const res = await rpcCall(server.url, 'getSlot');
    assert.equal(res.ok, false);
    assert.equal(res.error, 'HTTP 500');
  } finally {
    await server.close();
  }
});

test('rpcCall times out on a slow endpoint', async () => {
  const server = await startMockRpc(() => ({ result: 1, delayMs: 300 }));
  try {
    const res = await rpcCall(server.url, 'getSlot', [], 50);
    assert.equal(res.ok, false);
    assert.equal(res.error, 'timeout');
  } finally {
    await server.close();
  }
});

test('rpcCall fails cleanly when nothing is listening', async () => {
  const res = await rpcCall('http://127.0.0.1:1', 'getSlot', [], 2000);
  assert.equal(res.ok, false);
  assert.ok(res.error);
});

test('rpcCall retries a 429 and succeeds once the limit clears', async () => {
  let calls = 0;
  const server = await startMockRpc(() => {
    calls += 1;
    return calls === 1 ? { status: 429, body: {} } : { result: 7 };
  });
  try {
    const res = await rpcCall(server.url, 'getSlot', [], 5000, FAST);
    assert.equal(res.ok, true);
    assert.equal(res.result, 7);
    assert.equal(calls, 2);
  } finally {
    await server.close();
  }
});

test('rpcCall gives up after the retries are used up', async () => {
  let calls = 0;
  const server = await startMockRpc(() => {
    calls += 1;
    return { status: 429, body: {} };
  });
  try {
    const res = await rpcCall(server.url, 'getSlot', [], 5000, {
      retries: 2,
      retryDelayMs: 1,
    });
    assert.equal(res.ok, false);
    assert.equal(res.error, 'HTTP 429');
    assert.equal(calls, 3);
  } finally {
    await server.close();
  }
});

test('rpcCall does not retry errors other than 429', async () => {
  let calls = 0;
  const server = await startMockRpc(() => {
    calls += 1;
    return { status: 500, body: {} };
  });
  try {
    const res = await rpcCall(server.url, 'getSlot', [], 5000, FAST);
    assert.equal(res.ok, false);
    assert.equal(calls, 1);
  } finally {
    await server.close();
  }
});

test('rpcCall with retries set to 0 never retries', async () => {
  let calls = 0;
  const server = await startMockRpc(() => {
    calls += 1;
    return { status: 429, body: {} };
  });
  try {
    const res = await rpcCall(server.url, 'getSlot', [], 5000, {
      retries: 0,
      retryDelayMs: 1,
    });
    assert.equal(res.ok, false);
    assert.equal(calls, 1);
  } finally {
    await server.close();
  }
});

test('rateLimitHint only appears for rate limit errors', () => {
  assert.ok(
    rateLimitHint('Holder lookup failed: HTTP 429').includes('MINT_CHECK_RPC')
  );
  assert.equal(rateLimitHint('RPC request failed: fetch failed'), '');
  assert.equal(rateLimitHint(undefined), '');
});