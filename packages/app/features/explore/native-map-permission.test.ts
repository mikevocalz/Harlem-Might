import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { it } from 'node:test';
import { fileURLToPath } from 'node:url';

function check(scenario: string, boundary = 'none', outcome = 'fine', order = '') {
  const result = spawnSync(process.execPath, [
    '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    fileURLToPath(new URL('./test-helpers/native-map-attachment.mjs', import.meta.url)),
    `permission-${scenario}`, boundary, outcome, order,
  ], { encoding: 'utf8', timeout: 15_000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

for (const boundary of ['replace', 'null-ref', 'native-replace', 'effect-replay', 'remount', 'unmount', 'detached', 'failed']) {
  for (const outcome of ['fine', 'coarse', 'denied', 'reject']) {
    it(`Android permission ${outcome} after ${boundary} cannot mutate location state`, () => check('stale', boundary, outcome));
  }
}
for (const boundary of ['replace', 'native-replace', 'remount']) {
  for (const outcome of ['fine', 'denied', 'reject']) {
    for (const order of ['old-first', 'new-first']) {
      it(`Android ${outcome} from ${boundary} with ${order} preserves the current request`, () => check('overlap', boundary, outcome, order));
    }
  }
}
for (const outcome of ['fine', 'coarse', 'denied', 'reject', 'throw']) {
  it(`current Android permission ${outcome} preserves location controls and retry`, () => check('current', 'none', outcome));
}
it('Android repeated taps coalesce while pending and then use the latest location state', () => check('repeat'));
for (const outcome of ['fine', 'denied', 'reject']) {
  it(`hiding the current puck cancels an older ${outcome} permission request`, () => check('hide', 'none', outcome));
}
it('iOS keeps SDK-controlled location permission prompting', () => check('platform', 'ios'));
it('unsupported native builds keep location controls hidden', () => check('platform', 'unsupported'));
