// The link: dependencies keep sibling development possible; this contract makes
// the native source revision explicit without fetching or changing a checkout.
import { spawnSync } from 'node:child_process';
import { appendFileSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const siblingNames = ['viro', 'viro-external', 'nitro-mapbox-ar'];
const localDevelopmentVariable = 'HARLEM_NATIVE_LOCAL_DEV';

export function loadNativeRevisions(root = repositoryRoot) {
  const revisions = JSON.parse(readFileSync(resolve(root, 'tooling/native-revisions.json'), 'utf8'));
  if (!revisions || Array.isArray(revisions) ||
      Object.keys(revisions).sort().join(',') !== [...siblingNames].sort().join(',')) {
    throw new Error('native-revisions.json must pin viro, viro-external and nitro-mapbox-ar.');
  }
  for (const [name, revision] of Object.entries(revisions)) {
    if (typeof revision !== 'string' || !/^[0-9a-f]{40}$/.test(revision)) {
      throw new Error(`${name}: expected an immutable, full 40-character Git commit in native-revisions.json.`);
    }
  }
  return revisions;
}

function git(checkout, args) {
  // Never refresh an index or inherit a caller's alternative Git directory.
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete env[key];
  const result = spawnSync('git', ['-c', 'core.fsmonitor=false', '-C', checkout, ...args], {
    encoding: 'utf8', env,
  });
  if (result.status !== 0) {
    throw new Error(result.error?.message || result.stderr.trim() || 'Git inspection failed.');
  }
  return result.stdout.trimEnd();
}

function resolveInstalledPackageRoot(appRoot, name) {
  const require = createRequire(resolve(appRoot, 'package.json'));
  // Use the application's nearest-first package lookup paths, including the
  // workspace's hoisted node_modules. Reading package.json via require.resolve
  // would incorrectly reject packages whose exports hide that subpath; resolving
  // their JS entry can also require generated files before native prebuild.
  for (const directory of require.resolve.paths(name) ?? []) {
    const candidate = resolve(directory, name);
    try {
      lstatSync(candidate);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    // Do not skip a nearer stale or dangling link in favor of a correct hoisted
    // package: the application's source selection must be unambiguous.
    return realpathSync(candidate);
  }
  throw new Error('The package is not installed in the mobile application lookup paths.');
}

export function inspectNativeRevisions({
  root = repositoryRoot,
  revisions = loadNativeRevisions(root),
  env = process.env,
  checkInstalledLinks = false,
} = {}) {
  const errors = [];
  const reports = [];
  const localDevelopment = env[localDevelopmentVariable] === '1';
  const inCI = [env.CI, env.GITHUB_ACTIONS].some((value) => value && value !== 'false' && value !== '0');
  if (env[localDevelopmentVariable] && !localDevelopment) {
    errors.push(`${localDevelopmentVariable} must be unset or exactly 1 for intentional local sibling development.`);
  }
  if (localDevelopment && inCI) {
    errors.push(`${localDevelopmentVariable}=1 is forbidden in CI; native CI must use clean, pinned checkouts.`);
  }
  for (const name of siblingNames) {
    const checkout = resolve(root, '..', name);
    const expected = revisions[name];
    try {
      const actualRoot = git(checkout, ['rev-parse', '--show-toplevel']);
      // A directory inside a parent Git repository is not a sibling checkout.
      if (realpathSync(actualRoot) !== realpathSync(checkout)) {
        throw new Error('The sibling path is not the root of its own Git checkout.');
      }
      const actual = git(checkout, ['rev-parse', '--verify', 'HEAD^{commit}']);
      const status = git(checkout, ['status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=none']);
      const differences = [];
      if (actual !== expected) differences.push(`revision mismatch: expected ${expected}, found ${actual}`);
      if (status) differences.push(`dirty checkout (tracked or untracked changes):\n${status}`);
      const report = { name, checkout, expected, actual, status, differences };
      reports.push(report);
      if (differences.length && (!localDevelopment || inCI)) {
        errors.push(`${name} (${checkout}): ${differences.join('; ')}`);
      }
    } catch (error) {
      errors.push(`${name} (${checkout}): checkout unavailable or invalid; expected ${expected}. ${error.message}`);
    }
  }
  if (checkInstalledLinks) {
    const appRoot = resolve(root, 'apps/mobile');
    const { dependencies } = JSON.parse(readFileSync(resolve(appRoot, 'package.json'), 'utf8'));
    for (const [name, specifier] of Object.entries(dependencies)) {
      if (!specifier.startsWith('link:')) continue;
      const target = resolve(appRoot, specifier.slice('link:'.length));
      const pinnedSibling = siblingNames.some((sibling) => {
        const path = relative(resolve(root, '..', sibling), target);
        return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
      });
      try {
        if (!pinnedSibling) throw new Error('The linked source has no native revision pin.');
        if (resolveInstalledPackageRoot(appRoot, name) !== realpathSync(target)) {
          throw new Error('The installed package points to a different source checkout.');
        }
      } catch (error) {
        errors.push(`${name}: expected installed link to ${target}. ${error.message} Run pnpm install after preparing the pinned siblings.`);
      }
    }
  }
  return { ok: errors.length === 0, localDevelopment, reports, errors };
}

export function runNativeRevisionPreflight(options) {
  let result;
  try {
    result = inspectNativeRevisions(options);
  } catch (error) {
    console.error(`[Native revisions] ${error.message}`);
    return false;
  }
  for (const report of result.reports) {
    console.log(`[Native revisions] ${report.name}: ${report.actual} (${report.checkout})`);
    if (result.localDevelopment && report.differences.length) {
      console.error(`[Native revisions] LOCAL DEVELOPMENT: ${report.name}: ${report.differences.join('; ')}`);
    }
  }
  if (!result.ok) {
    console.error(`[Native revisions] ${result.errors.join('\n[Native revisions] ')}`);
    console.error('Restore clean sibling checkouts at the commits in tooling/native-revisions.json before retrying. No checkout was changed.\nFor intentional local source work only, set HARLEM_NATIVE_LOCAL_DEV=1 outside CI. Missing checkouts and fork capability failures still block. See docs/SPATIAL.md.');
  } else if (result.localDevelopment) {
    console.error('[Native revisions] LOCAL DEVELOPMENT opt-in: this run is not a reproducible pinned-native validation. Fork capability checks still apply.');
  } else {
    console.log('[Native revisions] All sibling checkouts match the clean, immutable CI revisions.');
  }
  return result.ok;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length === 2 && args[0] === '--github-output') {
    // CI consumes the same validated full SHAs as the native preflight.
    const revisions = loadNativeRevisions();
    appendFileSync(args[1], siblingNames.map((name) => `${name.replaceAll('-', '_')}=${revisions[name]}\n`).join(''));
  } else if (args.length === 0) {
    if (!runNativeRevisionPreflight()) process.exitCode = 1;
  } else {
    console.error('Usage: node tooling/native-revisions.mjs [--github-output <path>]');
    process.exitCode = 1;
  }
}
