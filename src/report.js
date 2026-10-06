import { checkMint, checkHolders, summarize } from './checks.js';

const LEVEL_RANK = { ok: 0, info: 0, warn: 1, danger: 2 };

// Builds the full report object that --json prints. The RPC is only ever
// identified by its host name.
export function buildReport(info, holders, rpcHost) {
  const findings = [
    ...checkMint(info),
    ...(holders.ok ? checkHolders(holders) : []),
  ];
  const summary = summarize(findings);

  return {
    mint: info.mint,
    program: info.programName,
    supply: info.supply,
    supplyRaw: info.supplyRaw,
    decimals: info.decimals,
    mintAuthority: info.mintAuthority,
    freezeAuthority: info.freezeAuthority,
    extensions: info.extensions,
    rpc: rpcHost,
    checksRun: holders.ok ? ['authority', 'holders'] : ['authority'],
    holders: holders.ok
      ? {
          sampledAccounts: holders.sampledAccounts,
          ownersResolved: holders.ownersResolved,
          top1: holders.top1,
          top5: holders.top5,
          top10: holders.top10,
          burnedPercent: holders.burnedPercent,
          top: holders.holders.slice(0, 10).map((holder) => ({
            owner: holder.owner,
            accounts: holder.accounts,
            amount: holder.amount,
            percent: holder.percent,
          })),
        }
      : { error: holders.error },
    findings: findings.map(({ id, level, title, detail }) => ({
      id,
      level,
      title,
      detail,
    })),
    summary,
    result: summary.level,
  };
}

// True when the result level reaches the --fail-on threshold.
export function shouldFail(level, failOn) {
  if (!failOn) return false;
  return LEVEL_RANK[level] >= LEVEL_RANK[failOn];
}