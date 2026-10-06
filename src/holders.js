import { rpcCall } from './rpc.js';
import { formatAmount } from './mint.js';

// Tokens sent to the incinerator are gone for good, so they are reported as
// burned instead of being counted as a holder.
export const BURN_ADDRESS = `1nc1nerator${'1'.repeat(32)}`;

// Share of the supply as a percentage with two decimals, using BigInt so large
// supplies never lose precision. Example: ("250", "1000") -> 25
export function percentOf(amountRaw, supplyRaw) {
  const supply = BigInt(supplyRaw);
  if (supply === 0n) return 0;
  return Number((BigInt(amountRaw) * 10000n) / supply) / 100;
}

// Token accounts have an owner wallet. That is the address people look up on
// a block explorer, so we group by it. Returns null if the lookup fails.
async function resolveOwners(addresses, rpcUrl, timeoutMs) {
  const res = await rpcCall(
    rpcUrl,
    'getMultipleAccounts',
    [addresses, { encoding: 'jsonParsed', commitment: 'confirmed' }],
    timeoutMs
  );

  if (!res.ok) return null;

  const values = res.result?.value;
  if (!Array.isArray(values) || values.length !== addresses.length) return null;

  return values.map((value) => value?.data?.parsed?.info?.owner ?? null);
}

export async function fetchTopHolders(info, rpcUrl, timeoutMs = 5000) {
  const largest = await rpcCall(
    rpcUrl,
    'getTokenLargestAccounts',
    [info.mint, { commitment: 'confirmed' }],
    timeoutMs
  );

  if (!largest.ok) {
    return { ok: false, error: `Holder lookup failed: ${largest.error}` };
  }

  const accounts = largest.result?.value ?? [];
  const owners =
    accounts.length > 0
      ? await resolveOwners(
          accounts.map((account) => account.address),
          rpcUrl,
          timeoutMs
        )
      : [];

  const ownersResolved = owners !== null && owners.every((owner) => owner !== null);

  // Group token accounts by owner. If an owner could not be resolved, the
  // token account address stands in for it.
  const groups = new Map();
  accounts.forEach((account, i) => {
    const owner = owners?.[i] ?? account.address;
    const entry = groups.get(owner) ?? { owner, accounts: 0, total: 0n };
    entry.accounts += 1;
    entry.total += BigInt(account.amount);
    groups.set(owner, entry);
  });

  const burned = groups.get(BURN_ADDRESS);
  const ranked = [...groups.values()]
    .filter((entry) => entry.owner !== BURN_ADDRESS)
    .sort((a, b) => (a.total === b.total ? 0 : a.total > b.total ? -1 : 1));

  const share = (n) =>
    percentOf(
      ranked.slice(0, n).reduce((sum, entry) => sum + entry.total, 0n),
      info.supplyRaw
    );

  return {
    ok: true,
    sampledAccounts: accounts.length,
    ownersResolved,
    holders: ranked.map((entry) => ({
      owner: entry.owner,
      accounts: entry.accounts,
      amountRaw: entry.total.toString(),
      amount: formatAmount(entry.total.toString(), info.decimals),
      percent: percentOf(entry.total, info.supplyRaw),
    })),
    burnedPercent: burned ? percentOf(burned.total, info.supplyRaw) : 0,
    top1: share(1),
    top5: share(5),
    top10: share(10),
  };
}

const pct = (value) => `${value.toFixed(2)}%`;

export function renderHolders(result, limit = 10) {
  const lines = [
    `Top holders (largest ${result.sampledAccounts} token accounts, grouped by owner)`,
  ];

  const rows = result.holders.slice(0, limit);

  if (rows.length === 0) {
    lines.push('  No holders found.');
  } else {
    const header = ['#', 'Owner', 'Share', 'Amount'];
    const body = rows.map((holder, i) => [
      String(i + 1),
      holder.owner,
      pct(holder.percent),
      holder.amount,
    ]);

    const widths = header.map((h, c) =>
      Math.max(h.length, ...body.map((row) => row[c].length))
    );
    const line = (cells) =>
      `  ${cells.map((cell, c) => cell.padEnd(widths[c])).join('  ')}`.trimEnd();

    lines.push(line(header));
    lines.push(line(widths.map((w) => '-'.repeat(w))));
    lines.push(...body.map(line));

    lines.push(
      '',
      `  Top 1: ${pct(result.top1)}   Top 5: ${pct(result.top5)}   Top 10: ${pct(result.top10)}`
    );
  }

  if (result.burnedPercent > 0) {
    lines.push(`  Burned: ${pct(result.burnedPercent)}`);
  }

  if (!result.ownersResolved) {
    lines.push(
      '  Note: some owners could not be resolved, so those rows show token account addresses.'
    );
  }

  return lines.join('\n');
}