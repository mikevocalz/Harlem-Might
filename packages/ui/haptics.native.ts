'use client';
/**
 * Premium interaction haptics via react-native-pulsar (Software Mansion).
 * Semantic vocabulary — components never call Pulsar directly.
 *
 * DEGRADES TO NO-OPS when the native module is absent.
 *
 * `react-native-pulsar` is a classic RN TurboModule (`codegenConfig`
 * RNPulsarSpec, `expoModule: false`), so it only exists once it has been
 * autolinked into a native build. Any JS-only reload — Fast Refresh, an OTA
 * update, or a dev client whose binary predates the dependency — reaches a
 * `TurboModuleRegistry.getEnforcing('RNPulsar')` that throws and takes the
 * whole screen down.
 *
 * Haptics are an enhancement, never a requirement, so a missing binary must
 * cost the user a vibration and nothing else. The import is resolved lazily and
 * guarded; the first failure is reported once and then silently ignored.
 */

type HapticFn = () => void;

let presets: typeof import('react-native-pulsar').Presets | null | undefined;

function loadPresets() {
  if (presets !== undefined) {
    return presets;
  }
  try {
    // Required lazily: importing at module scope makes the TurboModule lookup
    // happen during the import graph, before any try/catch can contain it.
    presets = (require('react-native-pulsar') as typeof import('react-native-pulsar')).Presets;
  } catch (error) {
    presets = null;
    console.warn(
      '[haptics] react-native-pulsar is unavailable, haptics are disabled. ' +
        'Rebuild the native app to link it.',
      error,
    );
  }
  return presets;
}

const guard =
  (select: (p: NonNullable<typeof presets>) => HapticFn): HapticFn =>
  () => {
    const loaded = loadPresets();
    if (!loaded) return;
    try {
      select(loaded)();
    } catch {
      // A haptic that fails mid-gesture must not surface to the user.
    }
  };

export const haptics = {
  /** button/row press */
  tap: guard((p) => p.System.impactLight),
  /** primary action confirmed */
  success: guard((p) => p.System.notificationSuccess),
  /** destructive/warning moment */
  warning: guard((p) => p.System.notificationWarning),
  /** tab/segment/selection change */
  selection: guard((p) => p.System.selection),
};
