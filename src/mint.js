import { rpcCall } from './rpc.js';

export const TOKEN_PROGRAMS = {
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: 'SPL Token',
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: 'Token-2022',
};

// Turns a raw integer amount into a readable one, using BigInt so huge
// supplies never lose precision. Example: ("1500000", 6) -> "1.5"
export function formatAmount(raw, decimals) {
  const value = BigInt(raw);
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;

  const wholeText = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (decimals === 0 || fraction === 0n) return wholeText;

  const fractionText = fraction
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '');

  return `${wholeText}.${fractionText}`;
}

export async function fetchMintInfo(mint, rpcUrl, timeoutMs = 5000) {
  const res = await rpcCall(
    rpcUrl,
    'getAccountInfo',
    [mint, { encoding: 'jsonParsed', commitment: 'confirmed' }],
    timeoutMs
  );

  if (!res.ok) {
    return { ok: false, error: `RPC request failed: ${res.error}` };
  }

  const account = res.result?.value;
  if (!account) {
    return {
      ok: false,
      error: 'Account not found. Check the address and the network.',
    };
  }

  const programName = TOKEN_PROGRAMS[account.owner];
  if (!programName) {
    return {
      ok: false,
      error: 'This address is not a token mint (it is owned by a different program).',
    };
  }

  const parsed = account.data?.parsed;
  if (!parsed || parsed.type !== 'mint') {
    return {
      ok: false,
      error:
        'This address is a token program account, but not a mint. Did you paste a token account address?',
    };
  }

  const info = parsed.info;
  const extensionDetails = info.extensions ?? [];

  return {
    ok: true,
    mint,
    program: account.owner,
    programName,
    decimals: info.decimals,
    supplyRaw: info.supply,
    supply: formatAmount(info.supply, info.decimals),
    mintAuthority: info.mintAuthority ?? null,
    freezeAuthority: info.freezeAuthority ?? null,
    isInitialized: info.isInitialized !== false,
    extensions: extensionDetails.map((entry) => entry.extension),
    extensionDetails,
  };
}