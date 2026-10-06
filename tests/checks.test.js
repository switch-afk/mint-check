import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkAuthorities,
  checkExtensions,
  checkMint,
  summarize,
  verdictLine,
  renderFindings,
} from '../src/checks.js';
import { fetchMintInfo } from '../src/mint.js';
import { startMockRpc } from './helpers/mock-rpc.js';

const AUTHORITY = 'Auth111111111111111111111111111111111111111';
const MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function makeInfo(overrides = {}) {
  return {
    mintAuthority: null,
    freezeAuthority: null,
    extensionDetails: [],
    ...overrides,
  };
}

const levels = (findings) => findings.map((f) => f.level);

test('revoked authorities are reported as ok', () => {
  const findings = checkAuthorities(makeInfo());

  assert.deepEqual(levels(findings), ['ok', 'ok']);
  assert.equal(findings[0].id, 'mint-authority');
  assert.equal(findings[1].id, 'freeze-authority');
});

test('active authorities are warnings and name the address', () => {
  const findings = checkAuthorities(
    makeInfo({ mintAuthority: AUTHORITY, freezeAuthority: AUTHORITY })
  );

  assert.deepEqual(levels(findings), ['warn', 'warn']);
  assert.ok(findings[0].detail.includes(AUTHORITY));
  assert.ok(findings[1].detail.includes(AUTHORITY));
});

test('a permanent delegate is a danger and names the delegate', () => {
  const findings = checkExtensions(
    makeInfo({
      extensionDetails: [
        { extension: 'permanentDelegate', state: { delegate: AUTHORITY } },
      ],
    })
  );

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, 'danger');
  assert.ok(findings[0].detail.includes(AUTHORITY));
});

test('a transfer fee is a warning and shows the current percentage', () => {
  const findings = checkExtensions(
    makeInfo({
      extensionDetails: [
        {
          extension: 'transferFeeConfig',
          state: { newerTransferFee: { transferFeeBasisPoints: 250 } },
        },
      ],
    })
  );

  assert.equal(findings[0].level, 'warn');
  assert.ok(findings[0].detail.includes('2.5%'));
});

test('transfer hook, pausable and non-transferable are warnings', () => {
  const findings = checkExtensions(
    makeInfo({
      extensionDetails: [
        { extension: 'transferHook', state: { programId: 'Hook1111' } },
        { extension: 'pausableConfig', state: {} },
        { extension: 'nonTransferable' },
      ],
    })
  );

  assert.deepEqual(levels(findings), ['warn', 'warn', 'warn']);
  assert.ok(findings[0].detail.includes('Hook1111'));
});

test('default account state only matters when it is frozen', () => {
  const frozen = checkExtensions(
    makeInfo({
      extensionDetails: [
        { extension: 'defaultAccountState', state: { accountState: 'frozen' } },
      ],
    })
  );
  const initialized = checkExtensions(
    makeInfo({
      extensionDetails: [
        { extension: 'defaultAccountState', state: { accountState: 'initialized' } },
      ],
    })
  );

  assert.equal(frozen.length, 1);
  assert.equal(frozen[0].level, 'warn');
  assert.equal(initialized.length, 0);
});

test('mint close authority is informational and unknown extensions are ignored', () => {
  const findings = checkExtensions(
    makeInfo({
      extensionDetails: [
        { extension: 'mintCloseAuthority', state: { closeAuthority: AUTHORITY } },
        { extension: 'metadataPointer', state: {} },
      ],
    })
  );

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, 'info');
});

test('summarize picks the worst level and verdictLine describes it', () => {
  const clean = summarize(checkMint(makeInfo()));
  assert.equal(clean.level, 'ok');
  assert.equal(
    verdictLine(clean),
    'Result: no red flags found in the authority checks'
  );

  const caution = summarize(checkMint(makeInfo({ mintAuthority: AUTHORITY })));
  assert.equal(caution.level, 'warn');
  assert.equal(caution.warn, 1);
  assert.equal(verdictLine(caution), 'Result: CAUTION (1 warning)');

  const danger = summarize(
    checkMint(
      makeInfo({
        mintAuthority: AUTHORITY,
        freezeAuthority: AUTHORITY,
        extensionDetails: [
          { extension: 'permanentDelegate', state: { delegate: AUTHORITY } },
        ],
      })
    )
  );
  assert.equal(danger.level, 'danger');
  assert.equal(verdictLine(danger), 'Result: DANGER (1 serious, 2 warnings)');
});

test('renderFindings prints a label, title and detail for each finding', () => {
  const output = renderFindings(
    checkMint(
      makeInfo({
        mintAuthority: AUTHORITY,
        extensionDetails: [
          { extension: 'permanentDelegate', state: { delegate: AUTHORITY } },
        ],
      })
    )
  );

  assert.ok(output.includes('[OK]'));
  assert.ok(output.includes('[WARN]'));
  assert.ok(output.includes('[DANGER]'));
  assert.ok(output.includes('Permanent delegate is set'));
  assert.ok(output.includes('Nobody can freeze your token account.'));
});

test('fetchMintInfo returns the raw extension details for the checks', async () => {
  const server = await startMockRpc(() => ({
    result: {
      context: { slot: 1 },
      value: {
        owner: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
        lamports: 1,
        executable: false,
        data: {
          program: 'spl-token-2022',
          space: 200,
          parsed: {
            type: 'mint',
            info: {
              decimals: 6,
              freezeAuthority: null,
              isInitialized: true,
              mintAuthority: null,
              supply: '1000000',
              extensions: [
                { extension: 'defaultAccountState', state: { accountState: 'frozen' } },
              ],
            },
          },
        },
      },
    },
  }));

  try {
    const info = await fetchMintInfo(MINT, server.url);

    assert.equal(info.ok, true);
    assert.deepEqual(info.extensions, ['defaultAccountState']);
    assert.equal(info.extensionDetails[0].state.accountState, 'frozen');

    const findings = checkMint(info);
    assert.equal(summarize(findings).level, 'warn');
  } finally {
    await server.close();
  }
});