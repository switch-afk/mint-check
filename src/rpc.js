export const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';

// Print only the host. RPC URLs often carry API keys in the path or query.
export function hostLabel(url) {
  try {
    return new URL(url).host;
  } catch {
    return 'invalid-url';
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function attemptCall(url, method, params, timeoutMs) {
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

// Rate-limited requests (HTTP 429) are retried with a growing delay. Every
// other failure is returned right away.
export async function rpcCall(
  url,
  method,
  params = [],
  timeoutMs = 5000,
  { retries = 2, retryDelayMs = 1000 } = {}
) {
  let res = await attemptCall(url, method, params, timeoutMs);

  for (let i = 0; i < retries && !res.ok && res.error === 'HTTP 429'; i++) {
    await sleep(retryDelayMs * (i + 1));
    res = await attemptCall(url, method, params, timeoutMs);
  }

  return res;
}

// Returns a hint to print under an error message, or '' when none applies.
export function rateLimitHint(message) {
  if (typeof message === 'string' && message.includes('429')) {
    return 'The public RPC is rate limiting this request. Set MINT_CHECK_RPC to your own RPC endpoint (free tiers work) and try again.';
  }
  return '';
}

// Very large tokens (USDC, for example) have too many token accounts for the
// RPC to list the largest ones. That is a limit of the RPC, not a mistake.
export function tooManyAccountsHint(message) {
  if (typeof message === 'string' && /too many accounts/i.test(message)) {
    return 'This token has too many holders for the RPC to list its largest accounts. That happens with very large tokens such as USDC. The authority checks above still apply.';
  }
  return '';
}

export function errorHint(message) {
  return rateLimitHint(message) || tooManyAccountsHint(message);
}