import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

test('journey commands require confirmation for stop forms and preserve pause/resume callers', () => {
  const compiler = spawnSync(process.execPath, [
    createRequire(import.meta.url).resolve('typescript/bin/tsc'),
    '--noEmit', '--project', fileURLToPath(new URL('./__typechecks__/tsconfig.json', import.meta.url)),
  ], { encoding: 'utf8', timeout: 30_000 });
  assert.ifError(compiler.error);
  assert.equal(compiler.status, 0, compiler.stdout + compiler.stderr);
});
