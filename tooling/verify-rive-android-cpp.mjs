#!/usr/bin/env node
// Host compile/ownership regression for the pinned Android descriptor. This is
// deliberately separate from an Android NDK link, emulator, or device test.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'apps/mobile/package.json'));
const pins = {
  '@rive-app/react-native': '0.5.2',
  'react-native-nitro-modules': '0.37.1',
  'react-native': '0.88.0-rc.4',
  expo: '58.0.7',
};
const packages = Object.fromEntries(Object.entries(pins).map(([name, version]) => {
  const manifest = require.resolve(`${name}/package.json`);
  assert.equal(JSON.parse(readFileSync(manifest, 'utf8')).version, version, `${name}: review this check before changing the native lane`);
  return [name, dirname(manifest)];
}));
const cpp = process.env.CXX || 'clang++';
const javaHome = process.env.JAVA_HOME;
const detectLeaks = process.env.RIVE_CPP_DETECT_LEAKS || '1';
assert(['0', '1'].includes(detectLeaks), 'RIVE_CPP_DETECT_LEAKS must be 0 or 1');
assert(javaHome && existsSync(join(javaHome, 'include/jni.h')), 'JAVA_HOME must point to a JDK with JNI headers');
const compilerVersion = run(cpp, ['--version']);
assert.match(compilerVersion.stdout, /clang version/, 'Use Clang, matching the Android compiler family');
const cache = resolve(process.env.RIVE_CPP_CACHE || join(tmpdir(), 'harlem-rive-cpp-cache'));
mkdirSync(cache, { recursive: true });
const archives = [
  {
    file: 'react-android-0.88.0-rc.4-release.aar',
    url: 'https://repo.maven.apache.org/maven2/com/facebook/react/react-android/0.88.0-rc.4/react-android-0.88.0-rc.4-release.aar',
    sha256: 'cdf169329ede5dc835b13a9fc15763190948a20e764957b1857ce6df7caa66b7',
  },
  {
    file: 'fbjni-0.7.0.aar',
    url: 'https://repo.maven.apache.org/maven2/com/facebook/fbjni/fbjni/0.7.0/fbjni-0.7.0.aar',
    sha256: '7e319ae110ac5e5ef18904170aea5c3e753e915d196699d7fd39d36c8e1dfe36',
  },
];
const temp = mkdtempSync(join(tmpdir(), 'harlem-rive-cpp-'));
try {
  for (const archive of archives) {
    const path = join(cache, archive.file);
    if (!existsSync(path)) {
      run('curl', ['--fail', '--location', '--retry', '2', '--max-time', '180', archive.url, '--output', `${path}.download`]);
      assert.equal(sha256(readFileSync(`${path}.download`)), archive.sha256, `${archive.file} checksum`);
      run('mv', [`${path}.download`, path]);
    }
    assert.equal(sha256(readFileSync(path)), archive.sha256, `${archive.file} checksum`);
    run('unzip', ['-q', path, 'prefab/modules/*/include/*', '-d', temp]);
  }
  const rn = packages['react-native'];
  const prefab = join(temp, 'prefab/modules/reactnative/include');
  // Prove the npm package and Maven prefab agree on the actual ownership types.
  for (const header of ['ConcreteShadowNode.h', 'ShadowNode.h', 'Props.h']) {
    const relative = `react/renderer/core/${header}`;
    assert.equal(sha256(readFileSync(join(rn, 'ReactCommon', relative))), sha256(readFileSync(join(prefab, relative))), `${header}: npm/prefab mismatch`);
  }
  assert.match(readFileSync(join(rn, 'gradle/libs.versions.toml'), 'utf8'), /^fbjni = "0\.7\.0"$/m);
  const nitroIncludes = join(temp, 'NitroModules');
  mkdirSync(nitroIncludes);
  // Same flattened public-header layout as Nitro's Android prefab, using the
  // installed 0.37.1 source headers rather than handwritten API substitutes.
  for (const file of readdirSync(join(packages['react-native-nitro-modules'], 'cpp'), { recursive: true })) {
    if (!file.endsWith('.hpp')) continue;
    const target = join(nitroIncludes, file.split('/').at(-1));
    assert(!existsSync(target), `Duplicate Nitro public header: ${file}`);
    symlinkSync(join(packages['react-native-nitro-modules'], 'cpp', file), target);
  }
  const generated = join(packages['@rive-app/react-native'], 'nitrogen/generated/shared/c++');
  const sourcePath = join(generated, 'views/HybridRiveViewComponent.cpp');
  const headerPath = join(generated, 'views/HybridRiveViewComponent.hpp');
  const source = readFileSync(sourcePath, 'utf8');
  const flags = [
    '-std=c++20', '-DANDROID', '-DRN_SERIALIZABLE_STATE',
    '-DFOLLY_NO_CONFIG=1', '-DFOLLY_MOBILE=1', '-DFOLLY_CFG_NO_COROUTINES=1',
    '-DFOLLY_HAVE_PTHREAD=1', '-DFOLLY_HAVE_CLOCK_GETTIME=1',
    '-Werror=return-stack-address',
    ...[join(rn, 'ReactCommon'), temp, prefab, join(temp, 'prefab/modules/jsi/include'),
      join(temp, 'prefab/modules/fbjni/include'), join(javaHome, 'include'),
      join(javaHome, 'include/linux'), generated, join(generated, 'views')].flatMap(path => ['-I', path]),
  ];
  // Compile the ENTIRE installed production TU to an object, including Android
  // adopt(), the props parser, generated Rive types, RN, and Nitro headers.
  run(cpp, [...flags, '-c', sourcePath, '-o', join(temp, 'descriptor.o')]);
  console.log('PASS: installed Rive Android descriptor compiled with pinned RN/Nitro headers');

  // Negative control: restore the exact removed lines from our package patch.
  // This must fail in the real RN header, proving the compile gate detects the
  // dangling shared_ptr regression, rather than merely accepting any source.
  const patch = readFileSync(join(root, 'patches/@rive-app__react-native@0.5.2.patch'), 'utf8');
  const descriptorPath = 'nitrogen/generated/shared/c++/views/HybridRiveViewComponent.cpp';
  const descriptorPatch = patch.split(/(?=^diff --git )/m).find(section =>
    section.startsWith(`diff --git a/${descriptorPath} b/${descriptorPath}\n`));
  assert(descriptorPatch, 'The package patch must include the production descriptor');
  const removed = descriptorPatch.split('\n').filter(line => line.startsWith('-') && !line.startsWith('---')).map(line => line.slice(1)).join('\n');
  const added = descriptorPatch.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++')).map(line => line.slice(1)).join('\n');
  assert(added && removed && source.includes(added), 'Installed Rive patch is missing or changed; reinstall and review the regression check');
  const negativePath = join(temp, 'unpatched-descriptor.cpp');
  writeFileSync(negativePath, source.replace(added, removed));
  const negative = run(cpp, [...flags, '-fsyntax-only', negativePath], { expectFailure: true });
  assert.match(negative.stderr, /returning reference to local temporary object/);
  assert.match(negative.stderr, /getConcreteSharedProps/);
  console.log('PASS: unpatched production descriptor rejected for RN dangling-reference getter');

  // The runtime fixture compiles the exact installed adopt() and state class,
  // with small node/props stand-ins. It tests shared_ptr ownership only; the full
  // TU compile above separately checks the real Fabric/Rive/Nitro type contract.
  const adopt = extractDefinition(source, 'void HybridRiveViewComponentDescriptor::adopt(');
  const state = extractDefinition(readFileSync(headerPath, 'utf8'), 'class HybridRiveViewState final') + ';';
  const shadowNodeCpp = readFileSync(join(rn, 'ReactCommon/react/renderer/core/ShadowNode.cpp'), 'utf8');
  const getProps = extractDefinition(shadowNodeCpp, 'const Props::Shared& ShadowNode::getProps() const');
  const concrete = readFileSync(join(rn, 'ReactCommon/react/renderer/core/ConcreteShadowNode.h'), 'utf8');
  const unsafeGetter = extractDefinition(concrete, 'const std::shared_ptr<const ConcreteProps> &getConcreteSharedProps() const');
  const fixture = readFileSync(join(root, 'tooling/rive-android-lifetime.fixture.cpp'), 'utf8')
    .replace('/* INSERT_RIVE_STATE */', state)
    .replace('/* INSERT_RN_GET_PROPS */', getProps)
    .replace('/* INSERT_RN_UNSAFE_GETTER */', unsafeGetter)
    .replace('/* INSERT_RIVE_ADOPT */', adopt);
  const fixturePath = join(temp, 'lifetime.cpp');
  writeFileSync(fixturePath, fixture);
  const executable = join(temp, 'lifetime');
  run(cpp, ['-std=c++20', '-O1', '-g', '-fno-omit-frame-pointer', '-fsanitize=address,undefined', '-Werror=return-stack-address', fixturePath, '-o', executable]);
  run(executable, [], { env: { ...process.env, ASAN_OPTIONS: `detect_stack_use_after_return=1:detect_leaks=${detectLeaks}`, UBSAN_OPTIONS: 'halt_on_error=1' } });
  console.log(`PASS: extracted production adopt/state ownership probe (ASan + UBSan, 1,000 clone/update/release cycles; LeakSanitizer ${detectLeaks === '1' ? 'enabled' : 'disabled'})`);
  console.log('Scope: Linux host C++ compile and lifetime regression only; Android NDK link/device and iOS gates remain required.');
} finally {
  rmSync(temp, { recursive: true, force: true });
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function run(command, args, { expectFailure = false, ...options } = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  if (expectFailure ? result.status === 0 : result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}\nExit: ${result.status}`);
  }
  return result;
}

function extractDefinition(source, start) {
  const at = source.indexOf(start);
  assert(at !== -1 && source.indexOf(start, at + start.length) === -1, `Expected exactly one definition: ${start}`);
  const open = source.indexOf('{', at);
  let depth = 1;
  let end = open + 1;
  while (depth > 0 && end < source.length) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
    end++;
  }
  assert.equal(depth, 0, `Unbalanced definition: ${start}`);
  return source.slice(at, end);
}
