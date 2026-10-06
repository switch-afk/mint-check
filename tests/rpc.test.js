import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hostLabel, rpcCall } from '../src/rpc.js';
import { startMockRpc } from './helpers/mock-rpc.js';

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
  const server = await startMockRpc(() => ({ status: 429, body: {} }));
  try {
    const res = await rpcCall(server.url, 'getSlot');
    assert.equal(res.ok, false);
    assert.equal(res.error, 'HTTP 429');
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