import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

test('the compiler accepts full/selected consumers and rejects false document promises', () => {
  const compiler = spawnSync(process.execPath, [
    createRequire(import.meta.url).resolve('typescript/bin/tsc'),
    '--noEmit', '--project', fileURLToPath(new URL('./__typechecks__/tsconfig.json', import.meta.url)),
  ], { encoding: 'utf8' });
  assert.ifError(compiler.error);
  assert.equal(compiler.status, 0, compiler.stdout + compiler.stderr);
});
