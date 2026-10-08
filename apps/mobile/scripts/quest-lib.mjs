// Pure helpers for scripts/quest.mjs. No I/O here, so node:test covers them
// without a device, an SDK or a Gradle run.

export const PACKAGE_NAME = 'com.harlemmight.app';
export const DEEP_LINK = 'harlemmight://explore';
export const REQUIRED_NODE = '24.15';
export const METRO_PORTS = Array.from({ length: 20 }, (_, i) => 8081 + i);

/** @param {string[]} argv */
export function parseArgs(argv) {
  const args = { install: false, serial: undefined, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--install') args.install = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--serial') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error('--serial needs a value, e.g. --serial 2G0YC1ZF8B0123');
      args.serial = value;
      i += 1;
    } else if (arg.startsWith('--serial=')) {
      args.serial = arg.slice('--serial='.length);
    } else {
      throw new Error(`unknown argument ${arg}`);
    }
  }
  if (args.serial && !args.install) args.install = true;
  return args;
}

/** True when `version` (e.g. "24.15.0") is on the pinned major.minor. */
export function isRequiredNode(version) {
  const [major, minor] = version.split('.');
  return `${major}.${minor}` === REQUIRED_NODE;
}

/** Highest build-tools directory name by numeric version (36.1.0 > 36.0.0 > 35.0.0). */
export function newestBuildTools(names) {
  const versions = names.filter((n) => /^\d+(\.\d+)*$/.test(n));
  if (versions.length === 0) return undefined;
  return versions.sort((a, b) => {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
      const d = (pb[i] ?? 0) - (pa[i] ?? 0);
      if (d !== 0) return d;
    }
    return 0;
  })[0];
}

/**
 * Checks the `aapt2 dump xmltree` text of a Quest APK's manifest. The quest
 * flavor must carry no PICO entries and must request the volumetric-window
 * permission that the Meta VR Layout SDK needs.
 */
export function checkQuestManifest(xmltree) {
  const leaks = xmltree
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /pico|pvr\./i.test(line));
  const hasVolumetric = xmltree.includes('MANAGE_APP_VOLUMETRIC_WINDOWS');
  return { leaks, hasVolumetric, ok: leaks.length === 0 && hasVolumetric };
}

/** Parses `adb devices` output into serials whose state is `device`. */
export function parseAdbDevices(output) {
  return output
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state === 'device')
    .map(([serial]) => serial);
}

/**
 * Picks the device to install on. Returns `{ serial }` or `{ error }` with
 * the exact fix.
 */
export function pickDevice(serials, requested) {
  if (requested) {
    return serials.includes(requested)
      ? { serial: requested }
      : { error: `device ${requested} is not attached (attached: ${serials.join(', ') || 'none'}). Fix: check \`adb devices\`, then pass a listed serial to --serial.` };
  }
  if (serials.length === 1) return { serial: serials[0] };
  if (serials.length === 0) {
    return { error: 'no adb device. Fix: connect the Quest by USB, accept "Allow USB debugging" in the headset, then check `adb devices`.' };
  }
  return { error: `${serials.length} adb devices attached (${serials.join(', ')}). Fix: rerun with --serial <one of them>.` };
}

/**
 * Chooses a Metro port. `owners` maps a listening port to the cwd of the
 * process on it (undefined when the port is free). A Metro started from
 * `appDir` is reused; another project's Metro is skipped.
 * Returns `{ port, reuse }` or undefined when every candidate is taken.
 */
export function chooseMetroPort(owners, appDir, ports = METRO_PORTS) {
  for (const port of ports) {
    const cwd = owners.get(port);
    if (cwd !== undefined && (cwd === appDir || cwd.startsWith(`${appDir}/`))) {
      return { port, reuse: true };
    }
  }
  for (const port of ports) {
    if (!owners.has(port)) return { port, reuse: false };
  }
  return undefined;
}
