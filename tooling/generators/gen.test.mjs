import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

const domainFiles = [
  'hooks/use-sample-domain.ts',
  'index.ts',
  'permissions/sample-domain.permissions.ts',
  'queries/sample-domain.keys.ts',
  'queries/sample-domain.queries.ts',
  'repository/sample-domain.repository.ts',
  'schemas/sample-domain.schema.ts',
  'services/sample-domain.service.ts',
  'types/sample-domain.types.ts',
];

test('domain CLI preserves its contracts inside the shared feature owner', async (t) => {
  const { cwd, output } = generate(t, 'domain', 'Sample-Domain');
  const domain = join(cwd, 'packages/app/features/sample-domain');
  assert.ok(existsSync(domain), 'Domain scaffolds must be owned by packages/app/features');
  assert.equal(existsSync(join(cwd, 'packages/app/sample-domain')), false);
  assert.deepEqual(readdirSync(domain, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(domain, join(entry.parentPath, entry.name)))
    .sort(), domainFiles);
  const { sampleDomainKeys } = await import(pathToFileURL(join(domain, 'index.ts')).href);
  assert.deepEqual(sampleDomainKeys.all, ['sample-domain']);

  const repository = readFileSync(join(domain, 'repository/sample-domain.repository.ts'), 'utf8');
  assert.match(repository, /@acme\/app\/content/);
  assert.match(repository, /injected/);
  assert.match(repository, /packages\/payload/);
  assert.doesNotMatch(repository, /ONLY code.*touches @acme\/payload/);
  const permissions = readFileSync(join(domain, 'permissions/sample-domain.permissions.ts'), 'utf8');
  assert.match(permissions, /client.*not authorization/i);
  assert.match(permissions, /packages\/app\/features\/auth\/member-session\.ts/);
  assert.match(permissions, /packages\/payload\/src\/access/);
  assert.doesNotMatch(permissions, /packages\/app\/permissions/);
  for (const path of ['packages/app/content/index.ts', 'packages/app/features/auth/member-session.ts', 'packages/payload/src/access']) {
    assert.ok(existsSync(join(root, path)), `Scaffold guidance must refer to an existing owner: ${path}`);
  }
  assert.match(output, /@acme\/app\/features\/sample-domain\/index\.ts/);
});

test('domain output is included by the actual app compiler and passes its ESLint boundaries', async (t) => {
  const { cwd } = generate(t, 'domain', 'sample-domain');
  const generatedApp = join(cwd, 'packages/app');
  // Use the real app config, presets, exports and installed tools, with no install
  // or compiler-option overrides that could hide an excluded feature or bad import.
  copyFileSync(join(app, 'tsconfig.json'), join(generatedApp, 'tsconfig.json'));
  copyFileSync(join(app, 'package.json'), join(generatedApp, 'package.json'));
  mkdirSync(join(cwd, 'node_modules/@acme'), { recursive: true });
  symlinkSync(join(root, 'packages/config'), join(cwd, 'node_modules/@acme/config'), 'dir');
  mkdirSync(join(generatedApp, 'features'), { recursive: true });
  writeFileSync(join(generatedApp, 'features/consumer.ts'),
    "import { sampleDomainKeys } from '@acme/app/features/sample-domain/index.ts';\n" +
    "export const scope: readonly ['sample-domain'] = sampleDomainKeys.all;\n");
  const compiled = spawnSync(process.execPath, [requireFromApp.resolve('typescript/bin/tsc'),
    '--project', generatedApp, '--pretty', 'false', '--listFiles'], { cwd, encoding: 'utf8' });
  assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
  const included = new Set(compiled.stdout.split(/\r?\n/));
  for (const path of domainFiles) {
    assert.ok(included.has(join(generatedApp, 'features/sample-domain', path)), `App compiler excluded ${path}`);
  }

  const eslint = new ESLint({ cwd: generatedApp, overrideConfigFile: join(app, 'eslint.config.mjs') });
  const results = await eslint.lintFiles(['features/sample-domain/**/*.ts']);
  assert.equal(results.length, domainFiles.length);
  assert.deepEqual(results.flatMap(({ filePath, messages }) => messages.map((message) => ({ filePath, ...message }))), []);

  // Negative controls prove generated paths remain subject to the real rules.
  const backend = await eslint.lintText("import type { Payload } from 'payload';\nexport type Backend = Payload;\n", {
    filePath: join(generatedApp, 'features/sample-domain/repository/sample-domain.repository.ts'),
  });
  assert.ok(backend[0].messages.some(({ ruleId }) => ruleId === 'no-restricted-imports'));
  const inlineKeys = await eslint.lintText("export const query = { queryKey: ['sample-domain'] };\n", {
    filePath: join(generatedApp, 'features/sample-domain/queries/sample-domain.queries.ts'),
  });
  assert.ok(inlineKeys[0].messages.some(({ ruleId }) => ruleId === 'no-restricted-syntax'));
});

test('domain and screen scaffolds can share one feature without overwriting contracts', (t) => {
  const { cwd } = generate(t, 'domain', 'sample-domain');
  const indexPath = join(cwd, 'packages/app/features/sample-domain/index.ts');
  const index = readFileSync(indexPath, 'utf8');
  const feature = spawnSync(process.execPath, [script, 'feature', 'sample-domain'], { cwd, encoding: 'utf8' });
  assert.equal(feature.status, 0, feature.stderr);
  assert.equal(readFileSync(indexPath, 'utf8'), index);
  assert.ok(existsSync(join(cwd, 'packages/app/features/sample-domain/screen.tsx')));
  const repeated = spawnSync(process.execPath, [script, 'domain', 'sample-domain'], { cwd, encoding: 'utf8' });
  assert.equal(repeated.status, 1);
  assert.match(repeated.stderr, /refusing to overwrite/);
  assert.equal(readFileSync(indexPath, 'utf8'), index);
});

test('invalid names are rejected before creating any scaffold files', async (t) => {
  const kebabNames = ['1domain', 'two words', 'bad_name', '-leading', 'trailing-',
    'two--parts', 'has.dot', '../escape', 'nested/name', 'back\\slash', "quote'name"];
  const invalidNames = {
    domain: kebabNames,
    feature: kebabNames,
    component: ['lowercase', '9Sample', 'Sample-Name', 'Sample_Name',
      'Sample/../Escape', 'Sample\\Escape', 'Sample Name', 'Sample;throw'],
  };
  for (const [kind, names] of Object.entries(invalidNames)) {
    for (const name of names) {
      await t.test(`${kind}: ${JSON.stringify(name)}`, (t) => {
        const cwd = mkdtempSync(join(tmpdir(), 'harlem-generator-invalid-'));
        t.after(() => rmSync(cwd, { recursive: true, force: true }));
        const result = spawnSync(process.execPath, [script, kind, name], { cwd, encoding: 'utf8' });
        assert.equal(result.status, 1, result.stdout + result.stderr);
        assert.match(result.stderr, /name must be/);
        assert.deepEqual(readdirSync(cwd), [], 'Invalid input must not create partial files');
      });
    }
  }
});
