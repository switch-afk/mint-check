export const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';

// Print only the host. RPC URLs often carry API keys in the path or query.
export function hostLabel(url) {
  try {
    return new URL(url).host;
  } catch {
    return 'invalid-url';
  }
}

export async function rpcCall(url, method, params = [], timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'RPC error');

    return { ok: true, result: data.result };
  } catch (err) {
    const message = err.name === 'AbortError' ? 'timeout' : err.message;
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}