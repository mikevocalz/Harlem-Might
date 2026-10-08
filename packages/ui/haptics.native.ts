'use client';
import { shouldPlayHaptic, type HapticMoment } from './haptic-policy';
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
let enabled = true;
let foreground = true;
const lastPlayedAt: Partial<Record<HapticMoment, number>> = {};

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
    if (!enabled || !foreground) return;
    const loaded = loadPresets();
    if (!loaded) return;
    try {
      select(loaded)();
    } catch {
      // A haptic that fails mid-gesture must not surface to the user.
    }
  };

const moment = (
  name: HapticMoment,
  select: (p: NonNullable<typeof presets>) => HapticFn,
): HapticFn => {
  const trigger = guard(select);
  return () => {
    const now = Date.now();
    if (!shouldPlayHaptic({ moment: name, now, lastPlayedAt: lastPlayedAt[name], enabled, foreground })) return;
    lastPlayedAt[name] = now;
    trigger();
  };
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
  /** Beginning a self-guided walk is a quiet positive moment. */
  walkStarted: moment('walkStarted', p => p.bloom),
  /** A verified route maneuver is approaching; always show directions too. */
  approachingTurn: moment('approachingTurn', p => p.System.impactMedium),
  /** A curator-sourced point of interest is nearby, not proof of arrival. */
  landmarkNearby: moment('landmarkNearby', p => p.blip),
  /** Arrival is confirmed by a separate navigation validation layer. */
  arrived: moment('arrived', p => p.bloom),
  stopConfirmed: moment('stopConfirmed', p => p.System.notificationSuccess),
  tourCompleted: moment('tourCompleted', p => p.ascent),
  routeChanged: moment('routeChanged', p => p.System.notificationWarning),
  /** Must be wired to the in-app preference; does not persist by itself. */
  setEnabled(state: boolean) {
    enabled = state;
    try {
      (require('react-native-pulsar') as typeof import('react-native-pulsar')).Settings.enableHaptics(state);
    } catch { /* Native module may be absent in a JS-only bundle. */ }
  },
  /** Root host must update from AppState; never cue while backgrounded. */
  setForeground(state: boolean) { foreground = state; },
};
