import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

for (const failure of ['none', 'create', 'read', 'corrupt']) {
  test(`the production native catalogue hydrates at mount and recovers ${failure} storage failure on foreground`, () => {
    const result = spawnSync(process.execPath, [
      fileURLToPath(new URL('./test-helpers/native-catalogue-startup.mjs', import.meta.url)), failure,
    ], { encoding: 'utf8', timeout: 15_000 });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
}
