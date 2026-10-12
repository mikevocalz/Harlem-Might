import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createFixtures } from './fixtures.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const here = fileURLToPath(new URL('./', import.meta.url));
const platform = process.argv[2];
assert.ok(['swift', 'kotlin'].includes(platform), 'Usage: node tooling/tests/walk-companion/run.mjs swift|kotlin');
const build = await mkdtemp(join(tmpdir(), 'harlem-wire-test-'));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} failed (status ${result.status}, signal ${result.signal})`);
}
async function freshFixtures() {
  const path = join(build, 'fixtures.json');
  // Generate after compilation so compiler/download time cannot expire the vectors.
  await writeFile(path, JSON.stringify(createFixtures()));
  return path;
}
async function mavenArtifacts() {
  const cache = join(tmpdir(), 'harlem-wire-maven');
  await mkdir(cache, { recursive: true });
  const manifest = JSON.parse(await readFile(join(here, 'maven-artifacts.json'), 'utf8'));
  return Promise.all(manifest.map(async ({ path, sha256 }) => {
    assert.match(path, /^[a-zA-Z0-9/_.-]+\.jar$/);
    assert.ok(!path.includes('..'));
    const local = join(cache, `${sha256}-${basename(path)}`);
    let data = await readFile(local).catch(error => { if (error.code !== 'ENOENT') throw error; });
    if (!data) {
      const response = await fetch(`https://repo.maven.apache.org/maven2/${path}`, { signal: AbortSignal.timeout(120_000) });
      assert.ok(response.ok, `Maven download failed: ${path} (${response.status})`);
      data = Buffer.from(await response.arrayBuffer());
    }
    assert.equal(createHash('sha256').update(data).digest('hex'), sha256, `Checksum mismatch: ${path}`);
    await writeFile(local, data);
    return local;
  }));
}
try {
  if (platform === 'swift') {
    const phone = join(root, 'apps/mobile/modules/walk-companion/ios/CompanionWire.swift');
    const watch = join(root, 'apps/mobile/targets/harlem-watch/CompanionWire.swift');
    assert.equal(await readFile(phone, 'utf8'), await readFile(watch, 'utf8'), 'Phone/watch wire sources diverged');
    run('swiftc', ['--version']);
    const binary = join(build, 'swift-wire-tests');
    run('swiftc', [phone, join(here, 'CompanionWireTests.swift'), '-o', binary]);
    run(binary, [await freshFixtures()]);
    // Fake only unavailable Apple/Expo APIs; compile both complete production
    // bridge files unchanged, including their registered lifecycle callbacks.
    const modules = ['ExpoModulesCore', 'UIKit', 'WatchConnectivity', 'WatchKit', 'SwiftUI'];
    const objects = [];
    for (const name of modules) {
      const object = join(build, `${name}.o`);
      run('swiftc', ['-swift-version', '5', '-parse-as-library', '-emit-module', '-emit-object',
        '-module-name', name, '-emit-module-path', join(build, `${name}.swiftmodule`),
        join(here, 'swift-platform-fakes', `${name}.swift`), '-o', object]);
      objects.push(object);
    }
    const lifecycle = join(build, 'swift-lifecycle-tests');
    const phoneBridge = join(root, 'apps/mobile/modules/walk-companion/ios/WalkCompanionModule.swift');
    const watchBridge = join(root, 'apps/mobile/targets/harlem-watch/WalkCompanion.swift');
    function compileLifecycle(phoneSource, watchSource, output) {
      run('swiftc', ['-swift-version', '5', '-I', build, phone, phoneSource, watchSource,
        join(here, 'CompanionHostScheduler.swift'), join(here, 'CompanionLifecycleTests.swift'),
        ...objects, '-o', output]);
    }
    compileLifecycle(phoneBridge, watchBridge, lifecycle);
    run(lifecycle, []);

    // Explicit negative controls only: reverse precisely the new live-transport
    // guards in temporary copies, preserving every other production byte. The
    // normal suite above always compiles the untouched production source paths.
    const phoneGuard = `                  session.activationState == .activated, session.isPaired,
                  session.isWatchAppInstalled, session.isReachable,
`;
    const watchGuard = `        guard WCSession.default.activationState == .activated, WCSession.default.isReachable,
              message["kind"] as? String == "snapshot", let json = message["json"] as? String,`;
    function reverseGuard(source, guard, previous, label) {
      assert.equal(source.split(guard).length, 2, `${label}: expected one exact fixed guard`);
      return source.replace(guard, previous);
    }
    const negative = join(build, 'negative-controls');
    await mkdir(negative);
    const negativePhone = join(negative, 'WalkCompanionModule.swift');
    const negativeWatch = join(negative, 'WalkCompanion.swift');
    await writeFile(negativePhone, reverseGuard(await readFile(phoneBridge, 'utf8'), phoneGuard, '', 'phone'));
    await writeFile(negativeWatch, reverseGuard(await readFile(watchBridge, 'utf8'), watchGuard,
      '        guard message["kind"] as? String == "snapshot", let json = message["json"] as? String,', 'watch'));
    const negativeBinary = join(build, 'swift-lifecycle-negative-controls');
    compileLifecycle(negativePhone, negativeWatch, negativeBinary);
    const cases = [
      ['phone queued command rechecks current pairing before delivery', 'Queued command was accepted after unpairing'],
      ['watch disconnected delivery cannot install an unseen handoff', 'Queued snapshot restored guidance after disconnect'],
    ];
    const result = spawnSync(negativeBinary, cases.map(([name]) => name), { cwd: root, encoding: 'utf8' });
    if (result.error) throw result.error;
    // Compiler errors, crashes, missing tests and unrelated assertion failures
    // must never be misreported as successful reproduction of the regressions.
    assert.equal(result.signal, null, `Negative-control executable crashed: ${result.stderr}`);
    assert.equal(result.status, 1, `Negative controls must fail their assertions: ${result.stdout} ${result.stderr}`);
    assert.equal(result.stderr.trim(), 'FAIL: 2/2 Swift lifecycle cases');
    assert.deepEqual(result.stdout.trim().split(/\r?\n/), cases.map(([name, reason]) => `FAIL: ${name}: ${reason}`));
    console.log(result.stdout.trim());
    console.log('PASS: Swift negative controls reproduced both queued-delivery regressions');
  } else {
    const artifacts = await mavenArtifacts();
    const compilerClasspath = artifacts.join(delimiter);
    const runtimeClasspath = artifacts.filter(path => /kotlin-stdlib-|android-json-/.test(path)).join(delimiter);
    const binary = join(build, 'kotlin-wire-tests.jar');
    run('java', ['-version']);
    run('java', ['-cp', compilerClasspath, 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler', '-version', '-no-stdlib', '-no-reflect']);
    run('java', ['-cp', compilerClasspath, 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler',
      '-no-stdlib', '-no-reflect', '-jvm-target', '17', '-classpath', runtimeClasspath,
      join(root, 'apps/mobile/modules/walk-companion/shared/android/com/harlemmight/companion/CompanionWire.kt'),
      join(here, 'CompanionWireTests.kt'),
      join(root, 'apps/mobile/modules/walk-companion/android/src/main/java/com/harlemmight/companion/WalkCompanionModule.kt'),
      join(root, 'apps/wearos/app/src/main/java/com/harlemmight/watch/WalkCompanion.kt'),
      join(here, 'CompanionLifecycleTests.kt'),
      ...(await readdir(join(here, 'platform-fakes'))).filter(name => name.endsWith('.kt')).sort().map(name => join(here, 'platform-fakes', name)),
      '-d', binary]);
    const fixtures = await freshFixtures();
    run('java', ['-cp', [binary, runtimeClasspath].join(delimiter), 'com.harlemmight.companion.CompanionWireTestsKt', fixtures]);
    run('java', ['-cp', [binary, runtimeClasspath].join(delimiter), 'com.harlemmight.lifecycle.CompanionLifecycleTestsKt', fixtures]);
  }
} finally {
  await rm(build, { recursive: true, force: true });
}
