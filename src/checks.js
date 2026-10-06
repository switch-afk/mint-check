// Each finding looks like: { id, level, title, detail }
// level is one of: ok, info, warn, danger

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

export function verdictLine(summary) {
  const plural = (n) => (n === 1 ? '' : 's');

  if (summary.danger > 0) {
    return `Result: DANGER (${summary.danger} serious, ${summary.warn} warning${plural(summary.warn)})`;
  }
  if (summary.warn > 0) {
    return `Result: CAUTION (${summary.warn} warning${plural(summary.warn)})`;
  }
  return 'Result: no red flags found in the authority checks';
}

export function renderFindings(findings) {
  return findings
    .map(
      (f) =>
        `  ${LABELS[f.level].padEnd(9)} ${f.title}\n  ${' '.repeat(9)} ${f.detail}`
    )
    .join('\n');
}