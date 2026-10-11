import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { it } from 'node:test';
import { fileURLToPath } from 'node:url';

function check(scenario: string, stage = 'identity') {
  const result = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', fileURLToPath(new URL('./test-helpers/mount-revalidation.mjs', import.meta.url)), scenario, stage], { encoding: 'utf8', timeout: 10_000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

for (const stage of ['walk', 'identity', 'command']) {
  it(`web journey remount preserves a same-owner start awaiting ${stage}`, () => check('remount', stage));
}
for (const boundary of ['focus', 'visibility', 'owner-change', 'logout']) {
  it(`web journey ${boundary} still revokes an uncommitted start`, () => check(boundary, 'command'));
}
it('web journey remount revalidates a committed session and retains the same owner', () => check('committed'));
it('web journey remount clears a committed session when its owner changed', () => check('committed-owner-change'));
