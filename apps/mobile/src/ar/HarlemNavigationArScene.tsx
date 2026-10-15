import { useMemo } from 'react';
import { ViroARScene, ViroBox, ViroMaterials, ViroNode, ViroPolygon, ViroQuad, ViroText } from '@reactvision/react-viro';
import { MapboxViroChevrons, MapboxViroRoute, type ReactVisionGeospatialNavigator } from '@mapbox/react-native-mapbox-ar-reactvision';
import { formatDistance } from '@acme/app/features/explore/place-model.ts';
import { arrivalTarget } from '@acme/app/features/navigation/model/route.ts';
import { hasActiveTrip } from '@acme/app/features/navigation/model/session.ts';
import {
  navigationFixStore,
  selectArTracking,
  selectPositioning,
  selectProgress,
  selectSession,
  useNavigationStore,
} from '@acme/app/features/navigation/session/navigationStore.ts';
import { palette } from '@acme/theme';
import { chevronStopAlongTrackM, isCurrentNavFrame, localPointOf, maneuverTurnDeg, navArPresentation, pointOnFrame } from './navAr';
import { useNavAr } from './navAr.store';
import { useNavigationArPlacement } from './useNavigationArPlacement';

type Vec3 = [number, number, number];

const GOLD = palette.mights.gold;
const GOLD_DIM = palette.mights['gold-dim'];
const INK = palette.mights['warm-black'];
const PAPER = palette.mights.paper;

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

function toVec3(p: readonly [number, number, number]): Vec3 {
  return [p[0], p[1], p[2]];
}

/** Phone-only Viro presentation of the shared walking route and acquired placement. */
export function HarlemNavigationArScene(props: { arSceneNavigator?: ReactVisionGeospatialNavigator }) {
  const { activeRoute, world, match, onTrackingUpdated, onCameraTransformUpdate } = useNavigationArPlacement(props.arSceneNavigator);
  const session = useNavigationStore(selectSession);
  const positioning = useNavigationStore(selectPositioning);
  const arTracking = useNavigationStore(selectArTracking);
  const progress = useNavigationStore(selectProgress);
  const alongM = useNavAr((s) => s.alongM);
  const observations = useNavAr((s) => s.observations);

  const frameCurrent = isCurrentNavFrame(world?.frame, activeRoute);
  const presentation = navArPresentation({
    session,
    positioning,
    arTracking,
    placement: world?.target,
    isMatched: frameCurrent && match?.kind === 'matched',
    headingConfidence: navigationFixStore.getState().heading?.confidence,
    observations,
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
      onTrackingUpdated={onTrackingUpdated}
      onCameraTransformUpdate={onCameraTransformUpdate}
    >
      {show3d && frameCurrent && world?.displayed && routeCoordinates ? (
        <>
          {presentation.kind === 'guidance' && presentation.showGroundRoute ? (
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
