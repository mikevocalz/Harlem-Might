import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const script = fileURLToPath(new URL('./gen.mjs', import.meta.url));
const app = join(root, 'packages/app');
const requireFromApp = createRequire(join(app, 'package.json'));
const { ESLint } = requireFromApp('eslint');

function generate(t, kind, name) {
  const cwd = mkdtempSync(join(tmpdir(), 'harlem-generator-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [script, kind, name], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return { cwd, output: result.stdout };
}

test('generated feature forks satisfy the actual shared-product import boundary', async (t) => {
  const { cwd } = generate(t, 'feature', 'sample-feature');
  const eslint = new ESLint({ cwd: app, overrideConfigFile: join(app, 'eslint.config.mjs') });
  for (const fork of ['native', 'web']) {
    const relativePath = `features/sample-feature/screen.${fork}.tsx`;
    const source = readFileSync(join(cwd, 'packages/app', relativePath), 'utf8');
    const results = await eslint.lintText(source, { filePath: join(app, relativePath) });
    assert.equal(results.length, 1);
    assert.deepEqual(results[0].messages, [], `${fork}: ${JSON.stringify(results[0].messages)}`);
    assert.match(source, /export function SampleFeatureScreen\(\)/);
  }
  assert.match(readFileSync(join(cwd, 'packages/app/features/sample-feature/screen.tsx'), 'utf8'),
    /export \{ SampleFeatureScreen \} from '\.\/screen\.web'/);
});

test('generated component instructions identify the existing UI public entry point', (t) => {
  const { cwd, output } = generate(t, 'component', 'SampleComponent');
  assert.ok(existsSync(join(cwd, 'packages/ui/SampleComponent.tsx')));
  assert.ok(existsSync(join(cwd, 'packages/ui/SampleComponent.stories.tsx')));
  const match = output.match(/to (packages\/ui\/[^\s]+) —/);
  assert.ok(match, output);
  assert.equal(match[1], 'packages/ui/index.ts');
  assert.ok(existsSync(join(root, match[1])), `Missing public entry: ${match[1]}`);
});
