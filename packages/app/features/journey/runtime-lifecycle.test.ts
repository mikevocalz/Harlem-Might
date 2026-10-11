import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { it } from 'node:test';
import { fileURLToPath } from 'node:url';

function check(scenario: string, reason = 'network') {
  const result = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', fileURLToPath(new URL('./test-helpers/runtime-lifecycle.mjs', import.meta.url)), scenario, reason], { encoding: 'utf8', timeout: 15_000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}
for (const reason of ['network', 'missing-token', 'unavailable']) {
  it(`failed ${reason} journey planning releases the real GPS watch and positioning timer`, () => check('failed-planning', reason));
  it(`WalkJourney renders ${reason} route errors only for its current stop`, () => check('render-error', reason));
}
it('clearing a journey ends its nested error trip', () => check('clear-error'));
it('stopping a journey ends its nested error trip', () => check('stop-error'));
it('failed member authentication preserves an unrelated Explore trip', () => check('auth-unrelated'));
it('member authentication still ends the current journey trip', () => check('auth-matching'));

it('a late failed journey request and clear preserve a newer Explore trip and its feed', () => check('superseded-planning'));
