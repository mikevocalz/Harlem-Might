import { canUseNavigationEarth, type NavigationArBuild } from './navArBuild.ts';
import type { ReactVisionSpatialBridge } from '@mapbox/react-native-mapbox-ar-reactvision/src/bridge.ts';
import type { GeospatialAnchor, SpatialAnchorRequest } from '@mapbox/react-native-mapbox-ar-reactvision/src/types.ts';

/** The Viro bridge passes ARCore's 68th-percentile uncertainties through unchanged. */
export interface EarthPose {
  readonly latitude: number;
  readonly longitude: number;
  readonly altitude: number;
  readonly horizontalAccuracy: number;
  readonly orientationYawAccuracy: number;
  readonly verticalAccuracy: number;
}

export interface ObservedEarthPose extends EarthPose {
  /** Conservative request-start time: the pinned bridge exposes no native pose timestamp. */
  readonly observedAtMs: number;
}

export const MAX_EARTH_REQUEST_AGE_MS = 1000;

/** Reject invalid/late native replies. Do not reinterpret 68% as 95% confidence. */
export function observeEarthPose(pose: EarthPose, requestedAtMs: number, nowMs: number): ObservedEarthPose | undefined {
  const values = [pose.latitude, pose.longitude, pose.altitude, pose.horizontalAccuracy,
    pose.orientationYawAccuracy, pose.verticalAccuracy, requestedAtMs, nowMs];
  if (!values.every(Number.isFinite) || nowMs < requestedAtMs || nowMs - requestedAtMs > MAX_EARTH_REQUEST_AGE_MS ||
      Math.abs(pose.latitude) > 90 || Math.abs(pose.longitude) > 180 || pose.horizontalAccuracy <= 0 ||
      pose.orientationYawAccuracy <= 0 || pose.orientationYawAccuracy > 180 || pose.verticalAccuracy <= 0) return undefined;
  return { ...pose, observedAtMs: requestedAtMs };
}

/** Release every allocated anchor, including partial success and late cancellation. */
export async function withGeospatialAnchors<T>(input: {
  readonly bridge: Pick<ReactVisionSpatialBridge, 'createAnchor' | 'removeAnchor'>;
  readonly requests: readonly [SpatialAnchorRequest, SpatialAnchorRequest];
  readonly isCurrent: () => boolean;
  readonly use: (first: GeospatialAnchor, second: GeospatialAnchor) => T;
}): Promise<T | undefined> {
  const anchors: GeospatialAnchor[] = [];
  try {
    for (const request of input.requests) {
      if (!input.isCurrent()) return undefined;
      const result = await input.bridge.createAnchor(request);
      // Even a malformed failed result can carry an allocated native handle.
      if (result.anchor) anchors.push(result.anchor);
      if (!result.success || !result.anchor || !result.anchor.position.every(Number.isFinite)) return undefined;
    }
    if (!input.isCurrent()) return undefined;
    return input.use(anchors[0]!, anchors[1]!);
  } finally {
    for (const anchor of anchors) {
      try { input.bridge.removeAnchor(anchor.anchorId); } catch { /* Navigator may already be torn down. */ }
    }
  }
}

// Serialize mode setup across effect remounts on the SAME native navigator.
// A cancelled enable must finish and disable before its successor enables.
const navigatorSetup = new WeakMap<object, Promise<void>>();

/** Cancellable, single-flight Earth polling; no callback may outlive its scene. */
export function startGeospatialPolling(input: {
  readonly build: NavigationArBuild;
  readonly navigator: object;
  readonly bridge: Pick<ReactVisionSpatialBridge, 'enableGeospatial' | 'disableGeospatial' | 'getCameraPose'>;
  readonly getEarthTrackingState: () => Promise<{ state: string }>;
  readonly canPoll: () => boolean;
  /** Route/calibration identity captured before any asynchronous native work. */
  readonly getGeneration: () => string | number;
  readonly now: () => number;
  readonly onStatus: (status: 'available' | 'unavailable') => void;
  readonly onUnavailable: () => void;
  readonly onPose: (pose: ObservedEarthPose, isCurrent: () => boolean) => Promise<void> | void;
  readonly schedule: (callback: () => void) => () => void;
}): { readonly ready: Promise<void>; poll(): Promise<void>; stop(): void } {
  let stopped = false;
  let enabled = false;
  let inFlight = false;
  let unschedule: (() => void) | undefined;
  const disable = () => {
    try { input.bridge.disableGeospatial(); } catch { /* Scene teardown may precede cleanup. */ }
    enabled = false;
  };
  const poll = async () => {
    if (!enabled || inFlight || stopped) return;
    if (!input.canPoll()) { input.onUnavailable(); return; }
    inFlight = true;
    const generation = input.getGeneration();
    const isCurrent = () => !stopped && input.canPoll() && input.getGeneration() === generation;
    const requestedAtMs = input.now();
    try {
      const earth = await input.getEarthTrackingState();
      if (!isCurrent()) return;
      if (earth.state !== 'Enabled') { input.onUnavailable(); return; }
      const nativePose = await input.bridge.getCameraPose();
      if (!isCurrent()) return;
      const pose = observeEarthPose(nativePose, requestedAtMs, input.now());
      if (!pose) { input.onUnavailable(); return; }
      await input.onPose(pose, isCurrent);
    } catch {
      if (!stopped) input.onUnavailable();
    } finally {
      inFlight = false;
    }
  };
  const ready = (navigatorSetup.get(input.navigator) ?? Promise.resolve()).then(async () => {
    if (stopped) return;
    if (!canUseNavigationEarth(input.build)) { input.onStatus('unavailable'); return; }
    try {
      const result = await input.bridge.enableGeospatial();
      if (stopped) { disable(); return; }
      if (result.kind !== 'enabled') { input.onStatus('unavailable'); return; }
      enabled = true;
      input.onStatus('available');
      unschedule = input.schedule(() => { void poll(); });
      void poll();
    } catch {
      disable();
      if (!stopped) input.onStatus('unavailable');
    }
  });
  navigatorSetup.set(input.navigator, ready);
  return {
    ready,
    poll,
    stop() {
      stopped = true;
      unschedule?.();
      if (enabled) disable();
    },
  };
}
