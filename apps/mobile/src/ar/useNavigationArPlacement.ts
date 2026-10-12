import { useEffect, useRef } from 'react';
import type { ViroCameraTransform } from '@reactvision/react-viro';
import { useStore } from 'zustand';
import {
  cameraYawDeg,
  createReactVisionSpatialBridge,
  slewPlacement,
  solveCompassPlacement,
  solveEnuPlacement,
  type EnuOrigin,
  type EnuPlacement,
  type GeoWorldPosition,
  type ReactVisionGeospatialNavigator,
} from '@mapbox/react-native-mapbox-ar-reactvision';
import { hasActiveTrip } from '@acme/app/features/navigation/model/session.ts';
import {
  navigationFixStore,
  selectActiveRoute,
  useNavigationStore,
} from '@acme/app/features/navigation/session/navigationStore.ts';
import {
  addYawSample,
  alongTrackOnFrame,
  arTrackingFromViro,
  canCompleteCalibration,
  compassYawAccuracyDeg,
  coordinateNorthOf,
  freshYawSamples,
  isFreshSample,
  MAX_CAMERA_AGE_MS,
  MAX_GEOSPATIAL_AGE_MS,
  MAX_MATCH_AGE_MS,
  MAX_YAW_PAIR_AGE_MS,
  isBetterPlacement,
  isCompassSettled,
  isCurrentNavFrame,
  localPointOf,
  placementConfidence,
  pointOnFrame,
  positioningRadius68M,
  projectNavRoute,
  rebasePlacement,
  shouldResolvePlacement,
  summarizeYawSamples,
  wrapDeg,
  type NavPlacement,
  type YawSample,
} from './navAr';
import { useNavAr } from './navAr.store';
import { startGeospatialPolling, withGeospatialAnchors } from './navArGeospatial';
import { NAVIGATION_AR_BUILD, canUseNavigationEarth } from './navArBuild';
import { getNavigationController } from './navigationRuntime';

/** Scene work (sampling, slewing, calibration) runs at most this often. */
const TICK_MS = 250;
/** ARCore Earth pose polling. */
const GEOSPATIAL_POLL_MS = 1000;
/** Anchor creation costs battery and network; throttle attempts, not only accepted solutions. */
const GEOSPATIAL_RESOLVE_MIN_INTERVAL_MS = 10000;
/** Feed ARCore Earth fixes into the shared pipeline only when they beat typical GPS. */
const MAX_GEOSPATIAL_FIX_R68_M = 10;
/** Earth pose good enough to solve a placement from. */
const MAX_GEOSPATIAL_SOLVE_YAW_DEG = 25;
const MAX_GEOSPATIAL_SOLVE_R68_M = 25;
/** A visual offset only. This does not measure or track the road surface. */
const ESTIMATED_EYE_HEIGHT_M = 1.4;
/** Second anchor for the yaw solve, north of the first. */
const REFERENCE_ANCHOR_M = 15;

interface CameraSample {
  readonly position: GeoWorldPosition;
  readonly forward: GeoWorldPosition;
  readonly timestampMs: number;
}

/**
 * Owns acquisition for the mounted phone AR scene: route-frame rebasing,
 * sensor evidence, geospatial polling, compass placement and calibration.
 * Reads the existing shared stores/controller; it never starts location or
 * plans a route. The camera host still owns the native world/reset lifetime.
 */
export function useNavigationArPlacement(navigator?: ReactVisionGeospatialNavigator) {
  const controller = getNavigationController();
  const activeRoute = useNavigationStore(selectActiveRoute);
  const match = useStore(navigationFixStore, (s) => s.match);
  const world = useNavAr((s) => s.world);
  const calibrationRevision = useNavAr((s) => s.calibrationRevision);

  const camera = useRef<CameraSample | undefined>(undefined);
  const yawSamples = useRef<YawSample[]>([]);
  const lastTick = useRef<number | undefined>(undefined);
  const lastSampledHeading = useRef<number | undefined>(undefined);
  useEffect(() => {
    yawSamples.current = [];
    camera.current = undefined;
    lastTick.current = undefined;
    lastSampledHeading.current = undefined;
  }, [calibrationRevision]);

  // Project once per route generation, and carry the transform across a
  // reroute in the same store write (atomic swap of geometry + placement).
  const routeKey = activeRoute ? `${activeRoute.route.id}#${activeRoute.generation}` : undefined;
  useEffect(() => {
    if (!activeRoute) return;
    const frame = projectNavRoute(activeRoute);
    const previous = useNavAr.getState().world;
    if (previous?.frame.routeId === frame.routeId && previous.frame.generation === frame.generation) return;
    const rebase = (p: EnuPlacement | undefined) => (p && previous ? rebasePlacement(p, previous.frame.origin, frame.origin) : undefined);
    useNavAr.getState().setWorld({
      frame,
      target: previous?.target ? { ...previous.target, placement: rebase(previous.target.placement)! } : undefined,
      displayed: rebase(previous?.displayed),
    });
    // routeKey captures route id and generation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  // Matched along-track distance on the current frame.
  useEffect(() => {
    useNavAr.getState().setAlongM(world ? alongTrackOnFrame(world.frame, match) : undefined);
  }, [match, world]);

  // ARCore Earth: feed precise fixes and solve placements from two anchors.
  useEffect(() => {
    if (!canUseNavigationEarth(NAVIGATION_AR_BUILD) || !navigator || typeof navigator.isGeospatialModeSupported !== 'function') {
      useNavAr.getState().setGeospatial('unavailable');
      return;
    }
    const bridge = createReactVisionSpatialBridge(navigator);
    let lastGeospatialSolveAttempt: { routeKey: string; revision: number; atMs: number } | undefined;
    const observationUnavailable = () => {
      const state = useNavAr.getState();
      state.setObservations({ ...state.observations, geospatialTimestampMs: undefined, geospatialConfidence: undefined });
    };
    const lifecycle = startGeospatialPolling({
      build: NAVIGATION_AR_BUILD,
      navigator,
      bridge,
      getEarthTrackingState: () => navigator.getEarthTrackingState(),
      now: Date.now,
      getGeneration: () => {
        const state = useNavAr.getState();
        return `${state.calibrationRevision}:${state.world?.frame.routeId}#${state.world?.frame.generation}`;
      },
      canPoll: () => {
        const nav = useNavigationStore.getState();
        return isCurrentNavFrame(useNavAr.getState().world?.frame, selectActiveRoute(nav)) &&
          nav.arTracking.kind === 'normal' && hasActiveTrip(nav.session) && nav.session.phase !== 'paused' &&
          isFreshSample(camera.current?.timestampMs, Date.now(), MAX_CAMERA_AGE_MS);
      },
      onStatus: (status) => useNavAr.getState().setGeospatial(status),
      onUnavailable: observationUnavailable,
      schedule: (callback) => {
        const interval = setInterval(callback, GEOSPATIAL_POLL_MS);
        return () => clearInterval(interval);
      },
      onPose: async (pose, isCurrent) => {
        const r68 = pose.horizontalAccuracy;
        const yaw68 = pose.orientationYawAccuracy;
        const state = useNavAr.getState();
        state.setObservations({ ...state.observations, geospatialTimestampMs: pose.observedAtMs,
          geospatialConfidence: placementConfidence(yaw68, r68) });
        if (r68 <= MAX_GEOSPATIAL_FIX_R68_M) {
          controller.ingestFix({
            coordinate: { latitude: pose.latitude, longitude: pose.longitude },
            accuracy: { horizontalM: r68 },
            timestampMs: pose.observedAtMs,
            source: 'ar-geospatial',
          });
        }
        const current = useNavAr.getState().world;
        if (!current) return;
        const now = Date.now();
        const revision = useNavAr.getState().calibrationRevision;
        const routeKey = `${current.frame.routeId}#${current.frame.generation}`;
        const due = current.target === undefined ||
          shouldResolvePlacement({ current: current.target, alongM: useNavAr.getState().alongM, nowMs: now });
        const cooledDown = !lastGeospatialSolveAttempt || lastGeospatialSolveAttempt.routeKey !== routeKey ||
          lastGeospatialSolveAttempt.revision !== revision ||
          now - lastGeospatialSolveAttempt.atMs >= GEOSPATIAL_RESOLVE_MIN_INTERVAL_MS;
        if (!due || !cooledDown || yaw68 > MAX_GEOSPATIAL_SOLVE_YAW_DEG || r68 > MAX_GEOSPATIAL_SOLVE_R68_M) return;
        lastGeospatialSolveAttempt = { routeKey, revision, atMs: now };
        const north = coordinateNorthOf(pose, REFERENCE_ANCHOR_M);
        const altitude = pose.altitude - ESTIMATED_EYE_HEIGHT_M;
        await withGeospatialAnchors({
          bridge,
          requests: [
            { mode: 'wgs84', coordinate: { latitude: pose.latitude, longitude: pose.longitude, altitude } },
            { mode: 'wgs84', coordinate: { ...north, altitude } },
          ],
          isCurrent: () => {
            const latest = useNavAr.getState();
            return isCurrent() && latest.calibrationRevision === revision &&
              latest.world?.frame.routeId === current.frame.routeId && latest.world.frame.generation === current.frame.generation &&
              isFreshSample(pose.observedAtMs, Date.now(), MAX_GEOSPATIAL_AGE_MS);
          },
          use: (a, b) => {
            const anchorOrigin: EnuOrigin = { frame: { kind: 'place', placeId: 'nav-anchor' },
              latitude: pose.latitude, longitude: pose.longitude, altitude: 0 };
            const reference = localPointOf(anchorOrigin, north);
            const atAnchor = solveEnuPlacement({
              originWorldPosition: a.position,
              referenceWorldPosition: b.position,
              reference: { frame: anchorOrigin.frame, eastM: reference[0], northM: -reference[2], upM: 0 },
            });
            const latest = useNavAr.getState().world;
            if (!latest) return;
            const solved: NavPlacement = {
              placement: rebasePlacement(atAnchor, anchorOrigin, latest.frame.origin),
              source: 'geospatial',
              confidence: placementConfidence(yaw68, r68),
              heightReference: 'estimated-eye-height',
              yawAccuracyDeg: yaw68,
              solvedAtAlongM: useNavAr.getState().alongM ?? 0,
              solvedAtMs: pose.observedAtMs,
            };
            if (!latest.target || isBetterPlacement(latest.target, solved)) {
              useNavAr.getState().setWorld({ ...latest, target: solved, displayed: latest.displayed ?? solved.placement });
            }
          },
        });
      },
    });
    return lifecycle.stop;
  }, [controller, navigator]);

  // Compass sampling, re-anchoring, slewing and calibration hand-off.
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const elapsedS = lastTick.current === undefined ? 0 : (now - lastTick.current) / 1000;
      lastTick.current = now;
      const state = useNavAr.getState();
      const current = state.world;
      const cam = camera.current;
      const nav = useNavigationStore.getState();
      const fixes = navigationFixStore.getState();
      const heading = fixes.heading;
      const along = state.alongM;
      // Publish the clock even when callbacks stop; stale evidence must disappear.
      const nextObservations = { ...state.observations, nowMs: now, cameraTimestampMs: cam?.timestampMs,
        headingTimestampMs: heading?.timestampMs, headingSource: heading?.source, matchTimestampMs: fixes.match?.timestampMs };
      state.setObservations(nextObservations);
      if (!current || !cam || !isCurrentNavFrame(current.frame, selectActiveRoute(nav))) return;
      const cameraFresh = nav.arTracking.kind === 'normal' && isFreshSample(cam.timestampMs, now, MAX_CAMERA_AGE_MS);
      const pairFresh = cameraFresh && heading !== undefined && heading.source !== 'course-over-ground' &&
        heading.confidence !== 'low' && isFreshSample(heading.timestampMs, now, MAX_YAW_PAIR_AGE_MS) &&
        Math.abs(cam.timestampMs - heading.timestampMs) <= MAX_YAW_PAIR_AGE_MS;
      yawSamples.current = pairFresh ? freshYawSamples(yawSamples.current, now) : [];
      if (!pairFresh) state.setCompassSamples(0);
      if (!cameraFresh || nav.session.phase === 'paused' || nav.session.phase === 'arrived') return;

      // Sample cameraYaw + heading while calibrating or when a re-solve is due.
      const resolveDue =
        current.target === undefined || shouldResolvePlacement({ current: current.target, alongM: along, nowMs: now });
      if (resolveDue && pairFresh && heading && lastSampledHeading.current !== heading.timestampMs) {
        try {
          lastSampledHeading.current = heading.timestampMs;
          yawSamples.current = addYawSample(yawSamples.current, {
            yawDeg: cameraYawDeg(cam.forward) + heading.headingDeg,
            timestampMs: now,
          });
          state.setCompassSamples(yawSamples.current.length);
        } catch {
          // Phone pointed at the ground or sky: never solve from the old window.
          yawSamples.current = [];
          state.setCompassSamples(0);
        }
      }

      const summary = summarizeYawSamples(yawSamples.current);
      if (resolveDue && pairFresh && isCompassSettled(summary) && fixes.match?.kind === 'matched' && summary &&
          nav.positioning.kind === 'tracking' && nav.positioning.confidence !== 'low' &&
          isFreshSample(fixes.match.timestampMs, now, MAX_MATCH_AGE_MS)) {
        const yawAccuracyDeg = compassYawAccuracyDeg(summary, heading);
        const horizontalAccuracyM = positioningRadius68M(nav.positioning);
        const solved = solveCompassPlacement({
          cameraWorldPosition: cam.position,
          cameraForward: cam.forward,
          trueHeadingDeg: wrapDeg(summary.meanDeg - cameraYawDeg(cam.forward)),
          headingAccuracyDeg: yawAccuracyDeg,
          cameraEnuOffset: (() => {
            const p = localPointOf(current.frame.origin, fixes.match.coordinate);
            // Visual offset only. Ground graphics stay hidden without a measured surface.
            return { eastM: p[0], northM: -p[2], upM: ESTIMATED_EYE_HEIGHT_M };
          })(),
          horizontalAccuracyM,
        });
        const next: NavPlacement = {
          placement: { position: solved.position, rotation: solved.rotation },
          source: 'compass',
          confidence: solved.confidence,
          heightReference: 'estimated-eye-height',
          yawAccuracyDeg,
          solvedAtAlongM: along ?? 0,
          solvedAtMs: now,
        };
        yawSamples.current = [];
        state.setCompassSamples(0);
        if (!current.target || isBetterPlacement(current.target, next)) {
          state.setWorld({ ...current, target: next, displayed: current.displayed ?? next.placement });
          return;
        }
        // A rejected solve does not refresh the old placement's evidence.
        return;
      }

      // Slew what is on screen toward the target, pivoting about the user.
      const latest = useNavAr.getState().world;
      if (latest?.target && latest.displayed && elapsedS > 0) {
        const pivot = along !== undefined ? pointOnFrame(latest.frame, along).point : ([0, 0, 0] as const);
        const step = slewPlacement({ current: latest.displayed, target: latest.target.placement, pivot, elapsedS });
        if (step.placement !== latest.displayed) state.setWorld({ ...latest, displayed: step.placement });
      }

      // Hand calibration over to guidance.
      if (
        canCompleteCalibration({
          session: nav.session,
          positioning: nav.positioning,
          arTracking: nav.arTracking,
          placement: useNavAr.getState().world?.target,
          isMatched: fixes.match?.kind === 'matched',
          headingConfidence: heading?.confidence,
          observations: nextObservations,
        })
      ) {
        controller.completeARCalibration();
      }
    };
    const interval = setInterval(tick, TICK_MS);
    return () => clearInterval(interval);
  }, [controller]);

  function onTrackingUpdated(state: number, reason: number) {
    const next = arTrackingFromViro(state, reason);
    const previous = useNavigationStore.getState().arTracking;
    controller.setArTracking(next);
    // Relocalization may change the world origin. Re-solve after recovery;
    // never re-authorize the pre-loss transform from a new camera callback.
    if (previous.kind === 'normal' && next.kind !== 'normal') useNavAr.getState().requestRecalibration();
  }

  function onCameraTransformUpdate(t: ViroCameraTransform) {
    if (t.position.every(Number.isFinite) && t.forward.every(Number.isFinite)) {
      camera.current = { position: t.position, forward: t.forward, timestampMs: Date.now() };
    } else camera.current = undefined;
  }

  return { activeRoute, world, match, onTrackingUpdated, onCameraTransformUpdate };
}
