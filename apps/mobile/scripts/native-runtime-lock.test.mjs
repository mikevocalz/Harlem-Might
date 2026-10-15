import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { parse, parseAllDocuments } from 'yaml';

const root = new URL('../../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const manifest = (path) => JSON.parse(read(`${path}/package.json`));
const workspace = parse(read('pnpm-workspace.yaml'));
// pnpm 12 writes a package-manager document before the workspace graph. Parsing
// just the first document silently misses every application dependency.
const documents = parseAllDocuments(read('pnpm-lock.yaml')).map((document) => {
  assert.deepEqual(document.errors, []);
  return document.toJS();
});
const lock = documents.find((document) => document.importers?.['apps/mobile']);
const runtime = workspace.catalog['react-native'];
const runtimeKey = `react-native@${runtime}`;
const patchHash = createHash('sha256')
  .update(read(workspace.patchedDependencies[runtimeKey]))
  .digest('hex');
const routerCompanions = {
  '@expo/metro-runtime': '58.0.14',
  '@expo/ui': '58.0.15',
};

function assertRuntimeReference(reference, label, version = runtime, hash = patchHash) {
  assert.equal(reference.split('(')[0], version, `${label}: wrong React Native runtime`);
  assert(reference.includes(`(patch_hash=${hash})`), `${label}: missing React Native patch`);
}

function dependencyEntries(record) {
  return Object.entries({
    ...record.dependencies,
    ...record.optionalDependencies,
    ...record.devDependencies,
  });
}

function assertRouterCompanionContext(graph, key, expected = routerCompanions) {
  const snapshot = graph.snapshots[key];
  assert(snapshot, `${key}: missing router snapshot`);
  const dependencies = Object.fromEntries(dependencyEntries(snapshot));
  for (const [name, version] of Object.entries(expected)) {
    const reference = dependencies[name];
    // UI is optional upstream, but if present it must be in the supported lane.
    if (name === '@expo/ui' && !reference) continue;
    assert(reference, `${key}: missing ${name} edge`);
    assert.equal(reference.split('(')[0], version, `${key}: wrong ${name} companion`);
    assert(graph.packages[`${name}@${version}`], `${key}: missing ${name} package record`);
    assert(graph.snapshots[`${name}@${reference}`], `${key}: missing ${name} snapshot`);
  }
}

// Follow actual snapshot edges. Peer-context suffixes can be opaque hashes, so
// checking importer strings alone cannot establish what expo-router resolves.
function assertImporterRuntime(graph, importer, version = runtime, hash = patchHash) {
  const visited = new Set();
  const contexts = new Map();
  const pending = dependencyEntries(graph.importers[importer]).map(([name, value]) => ({
    name,
    reference: value.version,
    parent: importer,
  }));
  while (pending.length) {
    const { name, reference, parent } = pending.pop();
    // Linked workspace/sibling packages have their own importers or independent
    // lockfiles. They are not registry snapshots in this lockfile.
    if (reference.startsWith('link:')) continue;
    const key = Object.hasOwn(graph.snapshots, `${name}@${reference}`)
      ? `${name}@${reference}`
      : reference; // npm aliases already contain the real package name.
    const snapshot = graph.snapshots[key];
    assert(snapshot, `${parent}: missing resolved snapshot for ${name}@${reference}`);
    const packageKey = key.split('(')[0];
    assert(graph.packages[packageKey], `${parent}: missing resolved package record for ${packageKey}`);
    if (name === 'react-native') {
      assertRuntimeReference(reference, parent, version, hash);
      contexts.set(parent, reference);
    }
    if (visited.has(key)) continue;
    visited.add(key);
    for (const [dependency, value] of dependencyEntries(snapshot)) {
      pending.push({ name: dependency, reference: value, parent: key });
    }
  }
  assert(contexts.size > 0, `${importer}: no React Native context was checked`);
  return contexts;
}

test('both pnpm lock documents match the pinned package manager and workspace', () => {
  assert.equal(documents.length, 2);
  assert(lock, 'workspace graph is missing');
  const manager = documents.find((document) => document !== lock);
  const pnpm = JSON.parse(read('package.json')).packageManager.replace(/^pnpm@/, '');
  assert.equal(manager.importers['.'].packageManagerDependencies.pnpm.version, pnpm);
  assert(manager.packages[`pnpm@${pnpm}`]);
  assert(manager.snapshots[`pnpm@${pnpm}`]);
  assert.equal(lock.catalogs.default['react-native'].version, runtime);
  assert.equal(lock.patchedDependencies[runtimeKey], patchHash);
});

test('Expo bundled native modules owns the selected React Native version', () => {
  const require = createRequire(new URL('../package.json', import.meta.url));
  assert.equal(require('expo/package.json').version, workspace.catalog.expo);
  assert.equal(require('expo/bundledNativeModules.json')['react-native'], runtime);
});

test('Router companions satisfy the shipped Expo SDK and Router release contracts', () => {
  const require = createRequire(new URL('../package.json', import.meta.url));
  const bundled = require('expo/bundledNativeModules.json');
  const router = require('expo-router/package.json');
  assert.equal(router.version, workspace.catalog['expo-router']);
  assert.equal(bundled['expo-router'], `~${router.version}`);
  const routerPackage = lock.packages[`expo-router@${router.version}`];
  assert(routerPackage, 'missing Router package record');
  for (const [name, version] of Object.entries(routerCompanions)) {
    assert.equal(bundled[name], `~${version}`, `${name}: Expo SDK contract changed`);
    assert.equal(router.peerDependencies[name], `^${version}`, `${name}: Router contract changed`);
    assert.equal(routerPackage.peerDependencies[name], router.peerDependencies[name]);
    if (name === '@expo/metro-runtime') assert.equal(router.dependencies[name], `^${version}`);
    assert.equal(workspace.catalog[name], version, `${name}: catalog is outside the selected contract`);
    assert.equal(lock.catalogs.default[name].version, version);
    const provider = lock.importers['apps/mobile'].dependencies[name];
    assert.equal(provider.specifier, 'catalog:');
    assert.equal(provider.version.split('(')[0], version);
  }
  assert.equal(router.peerDependenciesMeta['@expo/ui'].optional, true);
  const mobileRouter = lock.importers['apps/mobile'].dependencies['expo-router'];
  const mobileContext = lock.snapshots[`expo-router@${mobileRouter.version}`];
  const mobileDependencies = Object.fromEntries(dependencyEntries(mobileContext));
  assert(mobileDependencies['@expo/ui'], 'mobile Router must receive its declared UI provider');
});

test('every selected Router release context uses supported companion snapshots', () => {
  // Older Router releases can remain in unrelated dependency subgraphs with
  // their own contracts; this check covers every context of the selected pin.
  const prefix = `expo-router@${workspace.catalog['expo-router']}(`;
  const contexts = Object.keys(lock.snapshots).filter((key) => key.startsWith(prefix));
  assert(contexts.length > 0, 'no Router contexts were checked');
  for (const key of contexts) assertRouterCompanionContext(lock, key);
});

test('Router graph checks reject stale companions and dangling hashed contexts', () => {
  const key = 'expo-router@58.0.17(opaque-context-hash)';
  const reference = '58.0.14(another-opaque-context)';
  const graph = {
    packages: { '@expo/metro-runtime@58.0.14': {}, '@expo/ui@58.0.15': {} },
    snapshots: {
      [key]: {
        dependencies: { '@expo/metro-runtime': reference },
        optionalDependencies: { '@expo/ui': '58.0.15' },
      },
      [`@expo/metro-runtime@${reference}`]: {},
      '@expo/ui@58.0.15': {},
    },
  };
  assertRouterCompanionContext(graph, key);
  for (const [name, stale] of [['@expo/metro-runtime', '58.0.9'], ['@expo/ui', '58.0.14']]) {
    const broken = structuredClone(graph);
    const kind = name === '@expo/ui' ? 'optionalDependencies' : 'dependencies';
    broken.snapshots[key][kind][name] = stale;
    broken.packages[`${name}@${stale}`] = {};
    broken.snapshots[`${name}@${stale}`] = {};
    assert.throws(() => assertRouterCompanionContext(broken, key), /wrong .* companion/);
  }
  const missingPackage = structuredClone(graph);
  delete missingPackage.packages['@expo/metro-runtime@58.0.14'];
  assert.throws(() => assertRouterCompanionContext(missingPackage, key), /missing .* package record/);
  delete graph.snapshots[`@expo/metro-runtime@${reference}`];
  assert.throws(() => assertRouterCompanionContext(graph, key), /missing .* snapshot/);
});

test('every Skia context carries the verified web initialization retry patch', () => {
  const name = '@shopify/react-native-skia';
  const version = workspace.catalog[name];
  const key = `${name}@${version}`;
  assert(workspace.patchedDependencies[key], 'Skia retry patch must be registered');
  const hash = createHash('sha256').update(read(workspace.patchedDependencies[key])).digest('hex');
  assert.equal(lock.patchedDependencies[key], hash);
  const contexts = Object.keys(lock.snapshots).filter((snapshot) => snapshot.startsWith(`${name}@`));
  assert(contexts.length > 0, 'no Skia contexts were checked');
  for (const context of contexts) {
    assert.equal(context.split('(')[0], key);
    assert(context.includes(`(patch_hash=${hash})`), `${context}: missing Skia retry patch`);
  }
  for (const [parent, record] of [...Object.entries(lock.importers), ...Object.entries(lock.snapshots)]) {
    for (const [dependency, value] of dependencyEntries(record)) {
      if (dependency !== name) continue;
      const reference = typeof value === 'string' ? value : value.version;
      assert(reference.includes(`(patch_hash=${hash})`), `${parent}: unpatched Skia edge`);
      assert(lock.snapshots[`${name}@${reference}`], `${parent}: dangling Skia edge`);
    }
  }
});

test('the entire lock graph contains only the patched catalog React Native lane', () => {
  assert.deepEqual(Object.keys(lock.packages).filter((key) => key.startsWith('react-native@')), [runtimeKey]);
  const nativeSnapshots = Object.keys(lock.snapshots).filter((key) => key.startsWith('react-native@'));
  assert(nativeSnapshots.length > 0);
  for (const key of nativeSnapshots) assertRuntimeReference(key.slice('react-native@'.length), key);
  for (const [key, snapshot] of Object.entries(lock.snapshots)) {
    for (const [name, reference] of dependencyEntries(snapshot)) {
      if (name === 'react-native') {
        assertRuntimeReference(reference, key);
        assert(lock.snapshots[`react-native@${reference}`], `${key}: dangling native runtime edge`);
      }
    }
  }
});

// A wildcard peer auto-installs stable RN because '*' excludes prereleases.
// Private workspaces must provide the selected RC explicitly for development.
for (const importer of ['packages/app', 'packages/theme']) {
  test(`${importer} supplies the catalog native development runtime`, () => {
    assert.equal(manifest(importer).private, true);
    assert.equal(manifest(importer).devDependencies['react-native'], 'catalog:');
    const provider = lock.importers[importer].devDependencies['react-native'];
    assert(provider, `${importer}: missing explicit native runtime provider`);
    assert.equal(provider.specifier, 'catalog:');
    assertRuntimeReference(provider.version, importer);
    const contexts = assertImporterRuntime(lock, importer);
    if (importer === 'packages/app') {
      assert.equal(manifest(importer).devDependencies.react, 'catalog:');
      assert.equal(lock.importers[importer].devDependencies.react.version, workspace.catalog.react);
      // These include both direct and hashed/nested native peer contexts.
      for (const name of ['expo-router', 'react-native-reanimated', 'react-native-mmkv', 'react-native-worklets']) {
        assert([...contexts.keys()].some((key) => key.startsWith(`${name}@`)), `${name}: native context was not traversed`);
      }
    }
  });
}

test('graph traversal rejects stale and unpatched runtimes hidden behind a hashed context', () => {
  const version = '0.88.0-rc.4';
  const reference = `${version}(patch_hash=fixture)`;
  const graph = {
    importers: { app: { dependencies: { router: { version: '1.0.0(opaque-context-hash)' } } } },
    packages: { 'router@1.0.0': {}, [`react-native@${version}`]: {} },
    snapshots: {
      'router@1.0.0(opaque-context-hash)': { dependencies: { 'react-native': reference } },
      [`react-native@${reference}`]: {},
    },
  };
  assert.equal(assertImporterRuntime(graph, 'app', version, 'fixture').size, 1);
  for (const stale of ['0.87.1', version]) {
    const broken = structuredClone(graph);
    broken.snapshots['router@1.0.0(opaque-context-hash)'].dependencies['react-native'] = stale;
    broken.snapshots[`react-native@${stale}`] = {};
    broken.packages[`react-native@${stale}`] = {};
    assert.throws(() => assertImporterRuntime(broken, 'app', version, 'fixture'), /wrong React Native runtime|missing React Native patch/);
  }
  const missingPackage = structuredClone(graph);
  delete missingPackage.packages[`react-native@${version}`];
  assert.throws(() => assertImporterRuntime(missingPackage, 'app', version, 'fixture'), /missing resolved package record/);
  delete graph.snapshots[`react-native@${reference}`];
  assert.throws(() => assertImporterRuntime(graph, 'app', version, 'fixture'), /missing resolved snapshot/);
});
