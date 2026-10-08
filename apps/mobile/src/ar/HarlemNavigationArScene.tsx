import { useEffect, useMemo, useRef } from 'react';
import {
  ViroARScene,
  ViroBox,
  ViroMaterials,
  ViroNode,
  ViroPolygon,
  ViroQuad,
  ViroText,
  type ViroCameraTransform,
} from '@reactvision/react-viro';
import { useStore } from 'zustand';
import {
  MapboxViroChevrons,
  MapboxViroRoute,
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
import { formatDistance } from '@acme/app/features/explore/explore.store.ts';
import { radius68From95 } from '@acme/app/features/navigation/model/geo.ts';
import { arrivalTarget } from '@acme/app/features/navigation/model/route.ts';
import { hasActiveTrip } from '@acme/app/features/navigation/model/session.ts';
import {
  navigationFixStore,
  selectActiveRoute,
  selectArTracking,
  selectPositioning,
  selectProgress,
  selectSession,
  useNavigationStore,
} from '@acme/app/features/navigation/session/navigationStore.ts';
import { palette } from '@acme/theme';
import {
  addYawSample,
  alongTrackOnFrame,
  angle68From95,
  arTrackingFromViro,
  canCompleteCalibration,
  chevronStopAlongTrackM,
  compassYawAccuracyDeg,
  coordinateNorthOf,
  isBetterPlacement,
  isCompassSettled,
  localPointOf,
  maneuverTurnDeg,
  navArPresentation,
  placementConfidence,
  pointOnFrame,
  projectNavRoute,
  rebasePlacement,
  shouldResolvePlacement,
  summarizeYawSamples,
  wrapDeg,
  type NavPlacement,
  type YawSample,
} from './navAr';
import { useNavAr } from './navAr.store';
import { getNavigationController } from './navigationRuntime';

type Vec3 = [number, number, number];

const GOLD = palette.mights.gold;
const GOLD_DIM = palette.mights['gold-dim'];
const INK = palette.mights['warm-black'];
const PAPER = palette.mights.paper;

/** Scene work (sampling, slewing, calibration) runs at most this often. */
const TICK_MS = 250;
/** ARCore Earth pose polling. */
const GEOSPATIAL_POLL_MS = 1000;
/** Heading samples older than this are not paired with a camera pose. */
const MAX_HEADING_AGE_MS = 400;
/** Feed ARCore Earth fixes into the shared pipeline only when they beat typical GPS. */
const MAX_GEOSPATIAL_FIX_R68_M = 10;
/** Earth pose good enough to solve a placement from. */
const MAX_GEOSPATIAL_SOLVE_YAW_DEG = 25;
const MAX_GEOSPATIAL_SOLVE_R68_M = 25;
const EYE_HEIGHT_M = 1.4;
/** Second anchor for the yaw solve, north of the first. */
const REFERENCE_ANCHOR_M = 15;

const TURN_HEIGHT_M = 2.2;
const DESTINATION_HEIGHT_M = 3;

ViroMaterials.createMaterials({
  navArGold: { diffuseColor: GOLD, lightingModel: 'Constant', cullMode: 'None' },
  navArGoldDim: { diffuseColor: GOLD_DIM, lightingModel: 'Constant', cullMode: 'None' },
  navArInk: { diffuseColor: INK, lightingModel: 'Constant', cullMode: 'None' },
});

/** An upward arrow in the XY plane, rotated about z to show the turn. */
const TURN_ARROW: [number, number][] = [
  [0, 0.45],
  [-0.28, 0.12],
  [-0.09, 0.12],
  [-0.09, -0.45],
  [0.09, -0.45],
  [0.09, 0.12],
  [0.28, 0.12],
];

interface CameraSample {
  readonly position: GeoWorldPosition;
  readonly forward: GeoWorldPosition;
}

function toVec3(p: readonly [number, number, number]): Vec3 {
  return [p[0], p[1], p[2]];
}

/**
 * Phone AR walking guidance (spec Phase 3). Reads the shared navigation
 * session through `useNavigationStore` / `navigationFixStore`; it never plans
 * or refetches a route, and it never draws a straight line to the
 * destination.
 *
 * World transform: ARCore Earth through the geospatial bridge when the device
 * supports it (two WGS84 anchors → `solveEnuPlacement`), else the compass
 * (`solveCompassPlacement`, labelled lower confidence in the HUD). It is
 * solved once, then only slewed toward re-solves, so content stays fixed in
 * the world as the phone turns.
 *
 * Mounted only on phone builds (`canUseArNavigation`); the quest and pico
 * flavors never reach the ARCore calls below.
 */
export function HarlemNavigationArScene(props: { arSceneNavigator?: ReactVisionGeospatialNavigator }) {
  const controller = getNavigationController();
  const session = useNavigationStore(selectSession);
  const activeRoute = useNavigationStore(selectActiveRoute);
  const positioning = useNavigationStore(selectPositioning);
  const arTracking = useNavigationStore(selectArTracking);
  const progress = useNavigationStore(selectProgress);
  const match = useStore(navigationFixStore, (s) => s.match);
  const world = useNavAr((s) => s.world);
  const alongM = useNavAr((s) => s.alongM);

  const camera = useRef<CameraSample | undefined>(undefined);
  const yawSamples = useRef<YawSample[]>([]);
  const lastTick = useRef<number | undefined>(undefined);

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
    const navigator = props.arSceneNavigator;
    if (!navigator || typeof navigator.isGeospatialModeSupported !== 'function') {
      useNavAr.getState().setGeospatial('unavailable');
      return;
    }
    const bridge = createReactVisionSpatialBridge(navigator);
    let cancelled = false;
    let inFlight = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    const solveFromAnchors = async (latitude: number, longitude: number, altitude: number, yaw68: number, r68: number) => {
      const state = useNavAr.getState().world;
      if (!state) return;
      const anchorAltitude = altitude - EYE_HEIGHT_M;
      const north = coordinateNorthOf({ latitude, longitude }, REFERENCE_ANCHOR_M);
      const a = await bridge.createAnchor({ mode: 'wgs84', coordinate: { latitude, longitude, altitude: anchorAltitude } });
      const b = await bridge.createAnchor({ mode: 'wgs84', coordinate: { ...north, altitude: anchorAltitude } });
      try {
        if (!a.success || !a.anchor || !b.success || !b.anchor) return;
        const anchorOrigin: EnuOrigin = { frame: { kind: 'place', placeId: 'nav-anchor' }, latitude, longitude, altitude: 0 };
        const reference = localPointOf(anchorOrigin, north);
        const atAnchor = solveEnuPlacement({
          originWorldPosition: a.anchor.position,
          referenceWorldPosition: b.anchor.position,
          reference: { frame: anchorOrigin.frame, eastM: reference[0], northM: -reference[2], upM: 0 },
        });
        const current = useNavAr.getState().world;
        if (!current || cancelled) return;
        const solved: NavPlacement = {
          placement: rebasePlacement(atAnchor, anchorOrigin, current.frame.origin),
          source: 'geospatial',
          confidence: placementConfidence(yaw68, r68),
          yawAccuracyDeg: yaw68,
          solvedAtAlongM: useNavAr.getState().alongM ?? 0,
          solvedAtMs: Date.now(),
        };
        if (!current.target || isBetterPlacement(current.target, solved)) {
          useNavAr.getState().setWorld({ ...current, target: solved, displayed: current.displayed ?? solved.placement });
        }
      } finally {
        if (a.anchor) bridge.removeAnchor(a.anchor.anchorId);
        if (b.anchor) bridge.removeAnchor(b.anchor.anchorId);
      }
    };

    const poll = async () => {
      if (inFlight || cancelled) return;
      inFlight = true;
      try {
        const pose = await bridge.getCameraPose();
        const r68 = radius68From95(pose.horizontalAccuracy);
        const yaw68 = angle68From95(pose.orientationYawAccuracy);
        if (r68 <= MAX_GEOSPATIAL_FIX_R68_M) {
          controller.ingestFix({
            coordinate: { latitude: pose.latitude, longitude: pose.longitude },
            accuracy: { horizontalM: r68 },
            timestampMs: Date.now(),
            source: 'ar-geospatial',
          });
        }
        const current = useNavAr.getState().world;
        const due =
          current !== undefined &&
          (current.target === undefined ||
            shouldResolvePlacement({ current: current.target, alongM: useNavAr.getState().alongM, nowMs: Date.now() }));
        if (due && yaw68 <= MAX_GEOSPATIAL_SOLVE_YAW_DEG && r68 <= MAX_GEOSPATIAL_SOLVE_R68_M) {
          await solveFromAnchors(pose.latitude, pose.longitude, pose.altitude, yaw68, r68);
        }
      } catch {
        // No Earth pose yet (still localising, or tracking lost). The compass
        // path keeps working; the next poll tries again.
      } finally {
        inFlight = false;
      }
    };

    void bridge.enableGeospatial().then(
      (result) => {
        if (cancelled) return;
        if (result.kind !== 'enabled') {
          useNavAr.getState().setGeospatial('unavailable');
          return;
        }
        useNavAr.getState().setGeospatial('available');
        interval = setInterval(() => void poll(), GEOSPATIAL_POLL_MS);
      },
      () => {
        if (!cancelled) useNavAr.getState().setGeospatial('unavailable');
      },
    );
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      try {
        bridge.disableGeospatial();
      } catch {
        // The navigator may already be torn down with the scene.
      }
    };
  }, [controller, props.arSceneNavigator]);

  // Compass sampling, re-anchoring, slewing and calibration hand-off.
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const elapsedS = lastTick.current === undefined ? 0 : (now - lastTick.current) / 1000;
      lastTick.current = now;
      const state = useNavAr.getState();
      const current = state.world;
      const cam = camera.current;
      if (!current || !cam) return;
      const nav = useNavigationStore.getState();
      const fixes = navigationFixStore.getState();
      const heading = fixes.heading;
      const along = state.alongM;

      // Sample cameraYaw + heading while calibrating or when a re-solve is due.
      const resolveDue =
        current.target === undefined || shouldResolvePlacement({ current: current.target, alongM: along, nowMs: now });
      if (resolveDue && heading && now - heading.timestampMs <= MAX_HEADING_AGE_MS) {
        try {
          yawSamples.current = addYawSample(yawSamples.current, {
            yawDeg: cameraYawDeg(cam.forward) + heading.headingDeg,
            timestampMs: now,
          });
          state.setCompassSamples(yawSamples.current.length);
        } catch {
          // Phone pointed at the ground or sky: no usable yaw this tick.
        }
      }

      const summary = summarizeYawSamples(yawSamples.current);
      if (resolveDue && isCompassSettled(summary) && fixes.match?.kind === 'matched' && summary) {
        const yawAccuracyDeg = compassYawAccuracyDeg(summary, heading);
        const horizontalAccuracyM = nav.positioning.kind === 'tracking' ? nav.positioning.sigmaM : undefined;
        const solved = solveCompassPlacement({
          cameraWorldPosition: cam.position,
          cameraForward: cam.forward,
          trueHeadingDeg: wrapDeg(summary.meanDeg - cameraYawDeg(cam.forward)),
          headingAccuracyDeg: yawAccuracyDeg,
          cameraEnuOffset: (() => {
            const p = localPointOf(current.frame.origin, fixes.match.coordinate);
            return { eastM: p[0], northM: -p[2], upM: 0 };
          })(),
          horizontalAccuracyM,
        });
        const next: NavPlacement = {
          placement: { position: solved.position, rotation: solved.rotation },
          source: 'compass',
          confidence: solved.confidence,
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
        // Not better: keep the current one and start counting again from here.
        state.setWorld({ ...current, target: { ...current.target, solvedAtAlongM: along ?? 0, solvedAtMs: now } });
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
        })
      ) {
        controller.completeARCalibration();
      }
    };
    const interval = setInterval(tick, TICK_MS);
    return () => clearInterval(interval);
  }, [controller]);

  const presentation = navArPresentation({
    session,
    positioning,
    arTracking,
    placement: world?.target,
    isMatched: match?.kind === 'matched',
    headingConfidence: navigationFixStore.getState().heading?.confidence,
  });
  const show3d =
    (presentation.kind === 'guidance' && presentation.render === '3d') ||
    (presentation.kind === 'arrived' && presentation.showDestination);
  const showDestination =
    (presentation.kind === 'guidance' && presentation.showDestination) ||
    (presentation.kind === 'arrived' && presentation.showDestination);

  const routeCoordinates = activeRoute?.route.geometry.coordinates;
  const stopAlongM = alongM !== undefined ? chevronStopAlongTrackM(alongM, progress) : undefined;
  const turn = useMemo(() => {
    if (!world || alongM === undefined || !progress?.nextManeuver) return undefined;
    const turnDeg = maneuverTurnDeg(progress.nextManeuver);
    if (turnDeg === undefined) return undefined;
    const { point } = pointOnFrame(world.frame, alongM + progress.distanceToNextManeuverM);
    return { point, turnDeg, label: formatDistance(progress.distanceToNextManeuverM) };
  }, [alongM, progress, world]);
  const destination = useMemo(() => {
    if (!world || !hasActiveTrip(session)) return undefined;
    return { point: localPointOf(world.frame.origin, arrivalTarget(session.destination)), name: session.destination.name };
  }, [session, world]);

  return (
    <ViroARScene
      onTrackingUpdated={(state, reason) => controller.setArTracking(arTrackingFromViro(state, reason))}
      onCameraTransformUpdate={(t: ViroCameraTransform) => {
        camera.current = { position: t.position, forward: t.forward };
      }}
    >
      {show3d && world?.displayed && routeCoordinates ? (
        <>
          {presentation.kind === 'guidance' ? (
            <>
              <MapboxViroRoute
                route={routeCoordinates}
                origin={world.frame.origin}
                placement={world.displayed}
                color={GOLD_DIM}
                thickness={0.08}
                verticalOffset={0.01}
                polylineProps={{ opacity: 0.5 }}
              />
              {alongM !== undefined ? (
                <MapboxViroChevrons
                  points={world.frame.points}
                  placement={world.displayed}
                  fromAlongTrackM={alongM}
                  stopAlongTrackM={stopAlongM}
                  materials="navArGold"
                />
              ) : null}
            </>
          ) : null}
          <ViroNode position={toVec3(world.displayed.position)} rotation={toVec3(world.displayed.rotation)}>
            {presentation.kind === 'guidance' && turn ? (
              <ViroNode position={[turn.point[0], TURN_HEIGHT_M, turn.point[2]]} transformBehaviors={['billboardY']}>
                <ViroQuad position={[0, 0, -0.01]} width={1.1} height={1.5} materials={['navArInk']} opacity={0.85} />
                <ViroPolygon
                  position={[0, 0.2, 0]}
                  rotation={[0, 0, -turn.turnDeg]}
                  vertices={TURN_ARROW}
                  holes={[]}
                  materials={['navArGold']}
                />
                <ViroText
                  text={turn.label}
                  position={[0, -0.5, 0]}
                  width={1}
                  height={0.3}
                  style={{ color: PAPER, fontSize: 28, textAlign: 'center' }}
                  scale={[0.6, 0.6, 0.6]}
                />
              </ViroNode>
            ) : null}
            {showDestination && destination ? (
              <ViroNode position={[destination.point[0], 0, destination.point[2]]}>
                <ViroBox position={[0, DESTINATION_HEIGHT_M / 2, 0]} width={0.25} height={DESTINATION_HEIGHT_M} length={0.25} materials={['navArGold']} />
                <ViroText
                  text={destination.name}
                  position={[0, DESTINATION_HEIGHT_M + 0.4, 0]}
                  width={3}
                  height={0.5}
                  transformBehaviors={['billboardY']}
                  style={{ color: GOLD, fontSize: 30, textAlign: 'center' }}
                />
              </ViroNode>
            ) : null}
          </ViroNode>
        </>
      ) : null}
    </ViroARScene>
  );
}
