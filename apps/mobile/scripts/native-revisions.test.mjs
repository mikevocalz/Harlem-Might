import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { inspectNativeRevisions, loadNativeRevisions } from '../../../tooling/native-revisions.mjs';

const sourceRoot = fileURLToPath(new URL('../../../', import.meta.url));
const names = ['viro', 'viro-external', 'nitro-mapbox-ar'];
const cleanEnv = { ...process.env, CI: '', GITHUB_ACTIONS: '', HARLEM_NATIVE_LOCAL_DEV: '' };
for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete cleanEnv[key];

function git(path, ...args) {
  const result = spawnSync('git', ['-C', path, ...args], { encoding: 'utf8', env: cleanEnv });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trimEnd();
}

function write(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function fixture(t) {
  const parent = mkdtempSync(join(tmpdir(), 'harlem-native-revisions-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const root = join(parent, 'harlem');
  const revisions = {};
  const appManifest = JSON.parse(readFileSync(join(sourceRoot, 'apps/mobile/package.json'), 'utf8'));
  write(join(root, 'apps/mobile/package.json'), JSON.stringify(appManifest));
  const appRoot = join(root, 'apps/mobile');
  for (const [name, specifier] of Object.entries(appManifest.dependencies)) {
    if (!specifier.startsWith('link:')) continue;
    const target = join(appRoot, specifier.slice('link:'.length));
    mkdirSync(target, { recursive: true });
    // Like native source packages, hide package.json behind an exports map.
    write(join(target, 'package.json'), JSON.stringify({ name, version: '0.0.0-fixture', exports: { '.': './index.js' } }));
    write(join(target, 'index.js'), 'module.exports = {};');
    const installed = join(appRoot, 'node_modules', name);
    mkdirSync(dirname(installed), { recursive: true });
    symlinkSync(target, installed, 'dir');
  }
  for (const name of names) {
    const checkout = join(parent, name);
    mkdirSync(checkout, { recursive: true });
    git(checkout, 'init', '--quiet');
    git(checkout, 'config', 'user.name', 'Native fixture');
    git(checkout, 'config', 'user.email', 'native-fixture@example.invalid');
    write(join(checkout, '.gitignore'), 'node_modules/\nbuild/\n');
    write(join(checkout, 'source.txt'), 'native source\n');
    if (name === 'viro') {
      write(join(checkout, 'package.json'), JSON.stringify({
        name: '@reactvision/react-viro', version: '0.0.0-fixture',
        peerDependencies: { expo: '>=58 <59', 'react-native': '>=0.88 <0.89' },
      }));
      for (const [path, body] of Object.entries({
        'components/Utilities/ViroPlatform.ts': 'isPico isMetaHorizonXR',
        'components/Utilities/VRModuleOpenXR.ts': 'getOpenXRRuntimeCapabilities',
        'plugins/metaTargeting.ts': 'metaVrGlassesCompatible',
        'components/ViroRivePanel.tsx': '',
        'components/Spatial/ViroSpatialLayout.tsx': '',
      })) write(join(checkout, path), body);
    }
    git(checkout, 'add', '.');
    git(checkout, 'commit', '--quiet', '-m', 'native fixture');
    revisions[name] = git(checkout, 'rev-parse', 'HEAD');
  }
  write(join(root, 'tooling/native-revisions.json'), JSON.stringify(revisions));
  copyFileSync(join(sourceRoot, 'tooling/native-revisions.mjs'), join(root, 'tooling/native-revisions.mjs'));
  const entry = join(root, 'apps/mobile/scripts/assert-viro-fork.mjs');
  mkdirSync(dirname(entry), { recursive: true });
  copyFileSync(join(sourceRoot, 'apps/mobile/scripts/assert-viro-fork.mjs'), entry);
  return {
    parent, root, revisions,
    inspect: (env = {}) => inspectNativeRevisions({ root, env: { ...cleanEnv, ...env } }),
    run: (env = {}) => spawnSync(process.execPath, [entry], { encoding: 'utf8', env: { ...cleanEnv, ...env } }),
  };
}

test('clean exact revisions pass, report every SHA, and leave Git data untouched', (t) => {
  const f = fixture(t);
  const indices = names.map((name) => readFileSync(join(f.parent, name, '.git/index')));
  const result = f.inspect();
  assert.equal(result.ok, true);
  assert.deepEqual(result.reports.map(({ name, actual }) => [name, actual]), Object.entries(f.revisions));
  const native = f.run();
  assert.equal(native.status, 0, native.stderr);
  assert.match(native.stdout, /All sibling checkouts match/);
  assert.match(native.stdout, /Native fork verified/);
  for (const [i, name] of names.entries()) {
    assert.deepEqual(readFileSync(join(f.parent, name, '.git/index')), indices[i]);
    assert.equal(git(join(f.parent, name), 'rev-parse', 'HEAD'), f.revisions[name]);
  }
});

test('missing sibling checkout fails, even with local-development opt-in', (t) => {
  const f = fixture(t);
  rmSync(join(f.parent, 'viro-external'), { recursive: true, force: true });
  for (const env of [{}, { HARLEM_NATIVE_LOCAL_DEV: '1' }]) {
    const result = f.inspect(env);
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /viro-external.*checkout unavailable or invalid/);
  }
  assert.equal(f.run().status, 1);
});

test('wrong revision reports expected and actual SHA and blocks native entrypoint', (t) => {
  const f = fixture(t);
  const checkout = join(f.parent, 'nitro-mapbox-ar');
  write(join(checkout, 'source.txt'), 'next native source\n');
  git(checkout, 'commit', '--quiet', '-am', 'local native edit');
  const actual = git(checkout, 'rev-parse', 'HEAD');
  const result = f.inspect();
  assert.equal(result.ok, false);
  assert(result.errors.some((error) => error.includes(f.revisions['nitro-mapbox-ar']) && error.includes(actual)));
  assert.equal(f.run().status, 1);
  assert.equal(git(checkout, 'rev-parse', 'HEAD'), actual);
  const local = f.run({ HARLEM_NATIVE_LOCAL_DEV: '1' });
  assert.equal(local.status, 0, local.stderr);
  assert.match(local.stderr, /LOCAL DEVELOPMENT.*nitro-mapbox-ar.*revision mismatch/);
  assert.match(local.stderr, /not a reproducible pinned-native validation/);
});

for (const kind of ['modified', 'staged', 'deleted', 'untracked']) {
  test(`${kind} native source is rejected by default and explicit local development reports it`, (t) => {
    const f = fixture(t);
    const checkout = join(f.parent, 'viro-external');
    const path = join(checkout, 'source.txt');
    if (kind === 'deleted') rmSync(path);
    else if (kind === 'untracked') write(join(checkout, 'new-source.ts'), 'export const native = true;\n');
    else write(path, 'edited native source\n');
    if (kind === 'staged') git(checkout, 'add', 'source.txt');
    const before = git(checkout, 'status', '--porcelain=v1', '--untracked-files=all');
    const result = f.inspect();
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /viro-external.*dirty checkout/);
    assert.equal(result.reports.find(({ name }) => name === 'viro-external').status, before);
    const local = f.run({ HARLEM_NATIVE_LOCAL_DEV: '1' });
    assert.equal(local.status, 0, local.stderr);
    assert.match(local.stderr, /LOCAL DEVELOPMENT.*viro-external.*dirty checkout/);
    assert.equal(git(checkout, 'status', '--porcelain=v1', '--untracked-files=all'), before);
  });
}

test('ignored dependency and build artifacts do not dirty a pinned source checkout', (t) => {
  const f = fixture(t);
  write(join(f.parent, 'viro/node_modules/test/index.js'), 'dependency');
  write(join(f.parent, 'viro/build/native.o'), 'generated');
  assert.equal(f.inspect().ok, true);
});

test('a directory in a parent repository cannot impersonate a sibling checkout', (t) => {
  const f = fixture(t);
  git(f.parent, 'init', '--quiet');
  rmSync(join(f.parent, 'viro/.git'), { recursive: true, force: true });
  const result = f.inspect({ HARLEM_NATIVE_LOCAL_DEV: '1' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /not the root of its own Git checkout/);
});

test('a linked Git worktree at the pinned revision is supported', (t) => {
  const f = fixture(t);
  const checkout = join(f.parent, 'viro');
  const source = join(f.parent, 'viro-source');
  renameSync(checkout, source);
  git(source, 'worktree', 'add', '--detach', checkout, f.revisions.viro);
  assert.equal(f.inspect().ok, true);
  assert.equal(f.run().status, 0);
});

test('local-development opt-in never bypasses CI or accepts ambiguous values', (t) => {
  const f = fixture(t);
  for (const env of [
    { CI: 'true', HARLEM_NATIVE_LOCAL_DEV: '1' },
    { GITHUB_ACTIONS: 'true', CI: 'false', HARLEM_NATIVE_LOCAL_DEV: '1' },
    { HARLEM_NATIVE_LOCAL_DEV: 'true' },
  ]) {
    assert.equal(f.inspect(env).ok, false);
    assert.equal(f.run(env).status, 1);
  }
  assert.equal(f.inspect({ CI: 'true' }).ok, true);
});

test('local-development opt-in cannot bypass the existing Viro capability gate', (t) => {
  const f = fixture(t);
  write(join(f.parent, 'viro/components/Utilities/VRModuleOpenXR.ts'), 'missing the runtime probe');
  const result = f.run({ HARLEM_NATIVE_LOCAL_DEV: '1' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /LOCAL DEVELOPMENT.*viro.*dirty checkout/);
  assert.match(result.stderr, /Required fork capabilities/);
  assert.match(result.stderr, /typed OpenXR runtime capability probe/);
});

test('manifest rejects branch names, abbreviated SHAs, missing and unexpected pins', (t) => {
  const f = fixture(t);
  for (const revisions of [
    { ...f.revisions, viro: 'main' },
    { ...f.revisions, viro: '99b1d87' },
    { viro: f.revisions.viro },
    { ...f.revisions, extra: f.revisions.viro },
  ]) {
    write(join(f.root, 'tooling/native-revisions.json'), JSON.stringify(revisions));
    assert.throws(() => loadNativeRevisions(f.root), /immutable|must pin/);
    assert.equal(f.run().status, 1);
  }
});

test('CI consumes the same full immutable revisions, and checks them before install', (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'harlem-native-output-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const output = join(temp, 'output');
  const result = spawnSync(process.execPath, [join(sourceRoot, 'tooling/native-revisions.mjs'), '--github-output', output], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const revisions = loadNativeRevisions();
  assert.equal(readFileSync(output, 'utf8'), names.map((name) => `${name.replaceAll('-', '_')}=${revisions[name]}\n`).join(''));
  const workflow = readFileSync(join(sourceRoot, '.github/workflows/ci.yml'), 'utf8');
  assert.match(workflow, /id: native-revisions\n\s+run: node tooling\/native-revisions.mjs --github-output "\$GITHUB_OUTPUT"/);
  for (const name of names) {
    assert(workflow.includes(`repository: mikevocalz/${name}\n          ref: \${{ steps.native-revisions.outputs.${name.replaceAll('-', '_')} }}`));
  }
  assert(workflow.indexOf('run: node tooling/native-revisions.mjs\n') < workflow.indexOf('run: pnpm install'));
});


test('native preflight rejects a stale installed link even when expected siblings are clean', (t) => {
  const f = fixture(t);
  const installed = join(f.root, 'apps/mobile/node_modules/@mikevocalz/nitro-mapbox-ar');
  rmSync(installed);
  const unrelated = join(f.parent, 'unrelated-mapbox');
  mkdirSync(unrelated);
  symlinkSync(unrelated, installed, 'dir');
  for (const env of [{}, { HARLEM_NATIVE_LOCAL_DEV: '1' }]) {
    const result = f.run(env);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /installed package points to a different source checkout/);
  }
});

test('native preflight reports a missing installed sibling package', (t) => {
  const f = fixture(t);
  rmSync(join(f.root, 'apps/mobile/node_modules/@viro-external/ui'));
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /@viro-external\/ui: expected installed link/);
  assert.match(result.stderr, /Run pnpm install/);
});


test('valid workspace-root hoisted links pass from the mobile application', (t) => {
  const f = fixture(t);
  const appRoot = join(f.root, 'apps/mobile');
  renameSync(join(appRoot, 'node_modules'), join(f.root, 'node_modules'));
  const require = createRequire(join(appRoot, 'package.json'));
  assert.equal(require.resolve('@mikevocalz/nitro-mapbox-ar'), join(f.parent, 'nitro-mapbox-ar/index.js'));
  assert.throws(() => require.resolve('@mikevocalz/nitro-mapbox-ar/package.json'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Native fork verified/);
});

test('a nearer stale link cannot hide behind a correct root-hoisted source', (t) => {
  const f = fixture(t);
  const appRoot = join(f.root, 'apps/mobile');
  renameSync(join(appRoot, 'node_modules'), join(f.root, 'node_modules'));
  const stale = join(f.parent, 'stale-native');
  write(join(stale, 'package.json'), JSON.stringify({ name: '@mikevocalz/nitro-mapbox-ar', main: './index.js' }));
  write(join(stale, 'index.js'), 'module.exports = {};');
  const installed = join(appRoot, 'node_modules/@mikevocalz/nitro-mapbox-ar');
  mkdirSync(dirname(installed), { recursive: true });
  symlinkSync(stale, installed, 'dir');
  const require = createRequire(join(appRoot, 'package.json'));
  assert.equal(require.resolve('@mikevocalz/nitro-mapbox-ar'), join(stale, 'index.js'));
  for (const env of [{}, { HARLEM_NATIVE_LOCAL_DEV: '1' }]) {
    const result = f.run(env);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /installed package points to a different source checkout/);
  }
});

test('a dangling nearer link is reported instead of silently using a hoisted package', (t) => {
  const f = fixture(t);
  const appRoot = join(f.root, 'apps/mobile');
  renameSync(join(appRoot, 'node_modules'), join(f.root, 'node_modules'));
  const installed = join(appRoot, 'node_modules/@mikevocalz/nitro-mapbox-ar');
  mkdirSync(dirname(installed), { recursive: true });
  symlinkSync(join(f.parent, 'missing-native'), installed, 'dir');
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /@mikevocalz\/nitro-mapbox-ar: expected installed link/);
});
