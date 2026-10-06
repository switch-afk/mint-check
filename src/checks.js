// Each finding looks like: { id, level, title, detail }
// level is one of: ok, info, warn, danger

export const TOP_HOLDER_WARN = 20;
export const TOP10_WARN = 80;

const LABELS = {
  ok: '[OK]',
  info: '[INFO]',
  warn: '[WARN]',
  danger: '[DANGER]',
};

export function checkAuthorities(info) {
  const findings = [];

  if (info.mintAuthority === null) {
    findings.push({
      id: 'mint-authority',
      level: 'ok',
      title: 'Mint authority revoked',
      detail: 'Nobody can create more tokens, so the supply is fixed.',
    });
  } else {
    findings.push({
      id: 'mint-authority',
      level: 'warn',
      title: 'Mint authority is active',
      detail: `${info.mintAuthority} can create more tokens at any time. That is normal for managed tokens like stablecoins, but it is a risk for most community tokens.`,
    });
  }

  if (info.freezeAuthority === null) {
    findings.push({
      id: 'freeze-authority',
      level: 'ok',
      title: 'Freeze authority revoked',
      detail: 'Nobody can freeze your token account.',
    });
  } else {
    findings.push({
      id: 'freeze-authority',
      level: 'warn',
      title: 'Freeze authority is active',
      detail: `${info.freezeAuthority} can freeze any holder's token account, which blocks them from moving their tokens.`,
    });
  }

  return findings;
}

function checkExtension(entry) {
  const state = entry.state ?? {};

  switch (entry.extension) {
    case 'permanentDelegate':
      return {
        level: 'danger',
        title: 'Permanent delegate is set',
        detail: `${state.delegate ?? 'A permanent delegate'} can move or burn tokens from any holder's account without their approval.`,
      };

    case 'transferHook':
      return {
        level: 'warn',
        title: 'Transfer hook is set',
        detail: `A custom program (${state.programId ?? 'unknown'}) runs on every transfer and can block transfers.`,
      };

    case 'transferFeeConfig': {
      const bps = state.newerTransferFee?.transferFeeBasisPoints;
      const current =
        typeof bps === 'number' ? ` (currently ${bps / 100}%)` : '';
      return {
        level: 'warn',
        title: 'Transfer fee is enabled',
        detail: `Every transfer is charged a fee${current}, and the fee authority can change it.`,
      };
    }

    case 'pausableConfig':
      return {
        level: 'warn',
        title: 'Token can be paused',
        detail: 'A pause authority can halt all transfers of this token.',
      };

    case 'nonTransferable':
      return {
        level: 'warn',
        title: 'Token is non-transferable',
        detail: 'Tokens cannot be moved between wallets (soulbound).',
      };

    case 'defaultAccountState':
      if (state.accountState === 'frozen') {
        return {
          level: 'warn',
          title: 'New token accounts start frozen',
          detail: 'New holders cannot move tokens until the freeze authority thaws their account.',
        };
      }
      return null;

    case 'mintCloseAuthority':
      return {
        level: 'info',
        title: 'Mint can be closed',
        detail: 'A close authority can close the mint account once the supply is zero.',
      };

    default:
      return null;
  }
}

export function checkExtensions(info) {
  const findings = [];

  for (const entry of info.extensionDetails ?? []) {
    const finding = checkExtension(entry);
    if (finding) findings.push({ id: entry.extension, ...finding });
  }

  return findings;
}

export function checkMint(info) {
  return [...checkAuthorities(info), ...checkExtensions(info)];
}

// Concentration is a warning, never a danger: liquidity pools, bonding curves
// and exchanges often hold a large share of a perfectly fine token.
export function checkHolders(result) {
  if (result.holders.length === 0) {
    return [
      {
        id: 'holders',
        level: 'info',
        title: 'No holders found',
        detail: 'The token has no holders yet, or its supply is zero.',
      },
    ];
  }

  const findings = [];
  const top = result.holders[0];
  const topText = `${result.top1.toFixed(2)}%`;

  if (result.top1 >= TOP_HOLDER_WARN) {
    findings.push({
      id: 'top-holder',
      level: 'warn',
      title: `Largest holder owns ${topText} of the supply`,
      detail: `${top.owner} holds this share. It may be a liquidity pool, a bonding curve, an exchange or the creator, so check the address on a block explorer.`,
    });
  } else {
    findings.push({
      id: 'top-holder',
      level: 'ok',
      title: `Largest holder owns ${topText} of the supply`,
      detail: 'No single wallet dominates the supply.',
    });
  }

  const top10Text = `${result.top10.toFixed(2)}%`;

  if (result.top10 >= TOP10_WARN) {
    findings.push({
      id: 'top10-holders',
      level: 'warn',
      title: `Top 10 holders own ${top10Text} of the supply`,
      detail: 'The supply sits in a few wallets, so a few sellers can move the price. Pools and exchanges can account for part of this.',
    });
  } else {
    findings.push({
      id: 'top10-holders',
      level: 'ok',
      title: `Top 10 holders own ${top10Text} of the supply`,
      detail: 'The supply is spread across more wallets.',
    });
  }

  return findings;
}

export function summarize(findings) {
  const count = (level) => findings.filter((f) => f.level === level).length;
  const danger = count('danger');
  const warn = count('warn');

  return {
    ok: count('ok'),
    info: count('info'),
    warn,
    danger,
    level: danger > 0 ? 'danger' : warn > 0 ? 'warn' : 'ok',
  };
}

export function verdictLine(summary, scope = 'authority checks') {
  const plural = (n) => (n === 1 ? '' : 's');

  if (summary.danger > 0) {
    return `Result: DANGER (${summary.danger} serious, ${summary.warn} warning${plural(summary.warn)})`;
  }
  if (summary.warn > 0) {
    return `Result: CAUTION (${summary.warn} warning${plural(summary.warn)})`;
  }
  return `Result: no red flags found in the ${scope}`;
}

export function renderFindings(findings) {
  return findings
    .map(
      (f) =>
        `  ${LABELS[f.level].padEnd(9)} ${f.title}\n  ${' '.repeat(9)} ${f.detail}`
    )
    .join('\n');
}