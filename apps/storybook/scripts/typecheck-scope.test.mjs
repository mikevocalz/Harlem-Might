import assert from 'node:assert/strict';
import { dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';

const configPath = fileURLToPath(new URL('../tsconfig.json', import.meta.url));
const config = ts.readConfigFile(configPath, ts.sys.readFile);
assert.equal(config.error, undefined);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath));
assert.deepEqual(parsed.errors, []);
const files = new Set(parsed.fileNames.map((file) => relative(dirname(configPath), file).replaceAll('\\', '/')));

for (const file of ['.storybook/main.ts', '.storybook/preview.ts', 'css.d.ts']) {
  test(`the real TypeScript config includes ${file}`, () => {
    assert.ok(files.has(file), `tsc omitted ${file}; ordinary ** globs skip hidden directories`);
  });
}
