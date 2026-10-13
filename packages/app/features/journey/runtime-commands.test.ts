import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

for (const scenario of ['pause-resume', 'stop', 'confirm-stop', 'no-session']) {
  test(`the real journey command helper preserves ${scenario} behavior`, () => {
    const result = spawnSync(process.execPath, [
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
      fileURLToPath(new URL('./test-helpers/runtime-commands.mjs', import.meta.url)),
      scenario,
    ], { encoding: 'utf8', timeout: 15_000 });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
}
