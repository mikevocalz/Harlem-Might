import { useMemo, useState, type ComponentProps } from 'react';
import {
  VRQuestNavigatorBridge,
  ViroAmbientLight,
  ViroAnimations,
  ViroBox,
  ViroDirectionalLight,
  ViroGeometry,
  ViroMaterials,
  ViroNode,
  ViroPolyline,
  ViroQuad,
  ViroScene,
  ViroSkyBox,
  ViroText,
  exitVRScene,
} from '@reactvision/react-viro';
import { MapboxRasterClient } from '@mapbox/react-native-mapbox-ar/mapbox';
import {
  MapboxViroBuildings,
  MapboxViroGround,
  MapboxViroRoute,
  unprojectFromEnu,
} from '@mapbox/react-native-mapbox-ar-reactvision';
import { MAPPED_PLACES, getHarlemPlacePreview, useExplore } from '@acme/app';
import { palette } from '@acme/theme';
import { DIORAMA_ALTITUDE_M, tabletopOrigin } from './arTabletop';
import { useArSession } from './arSession.store';
import { mapboxToken } from './mapboxToken';
import {
  chevronMesh,
  formatDistance,
  navSteps,
  routeDistanceM,
  stanceForStep,
  stepLines,
  turnIndicator,
  type GroundMesh,
} from './streetNavigation';
import type { ManualOrigin } from './streetNavigationPort';
import { estimatedHeightCount, useStreetMap } from './streetMap.store';
import { manualOriginLabel, panelLines } from './streetPanel';
import { useStreetNavigation } from './useStreetNavigation';
import {
  LABEL_FONT_PT,
  groundDistanceM,
  groundGrid,
  labelScaleForDistance,
  streetBounds,
  streetPillars,
  teleportTarget,
  worldRootTransform,
  type EnuGround,
} from './streetScene';

type Vec3 = [number, number, number];

/** Walkable margin around the outermost places, in metres. */
const BOUNDS_MARGIN_M = 60;
const GRID_SPACING_M = 25;
const GRID_LIFT_M = 0.02;
const GRID_THICKNESS_M = 0.06;
/** Satellite imagery sits just above the dark base ground. */
const IMAGERY_LIFT_M = 0.01;
/** The walking route as a ribbon on the sidewalk. */
const ROUTE_LIFT_M = 0.04;
const ROUTE_THICKNESS_M = 0.6;
const CHEVRON_LIFT_M = 0.06;
const TURN_LIFT_M = 0.07;
const TURN_THICKNESS_M = 0.35;
/** Distance badge over the next turn, above head height. */
const BADGE_HEIGHT_M = 2.6;
/**
 * Places stand in buildings, so pillars rise above typical Harlem roofs
 * (five to six storeys) and their labels sit on top.
 */
const PILLAR_WIDTH_M = 0.6;
const PILLAR_HEIGHT_M = 26;
/** Near a pillar its label hangs at street level; farther away it tops the pillar, above the roofs. */
const NEAR_LABEL_DISTANCE_M = 40;
const NEAR_LABEL_HEIGHT_M = 3.2;
const labelHeightM = (distanceM: number) =>
  distanceM < NEAR_LABEL_DISTANCE_M ? NEAR_LABEL_HEIGHT_M : PILLAR_HEIGHT_M + 0.2;
/** Where the wearer stands relative to a place they jump to: just south, facing north. */
const PLACE_STANCE: EnuGround = { eastM: 0, northM: -4 };
/** Scene-fixed control panel: below eye line, inside 1.0 to 2.0 m. */
const PANEL_POSITION: Vec3 = [0, 1.0, -1.25];
const PANEL_ROTATION: Vec3 = [-20, 0, 0];
const PANEL_W_M = 0.9;
const PANEL_H_M = 0.58;
/** 22 pt at 0.1 is about 2.6 cm, one degree at 1.5 m (HarlemTabletopScene). */
const PANEL_TEXT_SCALE: Vec3 = [0.1, 0.1, 0.1];
/** Buttons are 26 x 8 cm: above Meta's 48 mm ray and 64 mm pinch minimums. */
const BUTTON_W_M = 0.26;
const BUTTON_H_M = 0.08;
const BUTTON_COLUMNS = [-0.29, 0, 0.29] as const;
const FADE_MS = 120;

const GOLD = palette.mights.gold;
const GOLD_DIM = palette.mights['gold-dim'];
const INK = palette.mights['warm-black'];
const PAPER = palette.mights.paper;
const LIMESTONE = palette.mights.limestone;
/** A night sky a step above the ground, so the horizon stays visible. */
const SKY = '#1A1510';

ViroMaterials.createMaterials({
  harlemStreetGround: { diffuseColor: INK, lightingModel: 'Constant', cullMode: 'None' },
  harlemStreetGrid: { diffuseColor: '#3A2F1C', lightingModel: 'Constant' },
  harlemStreetGold: { diffuseColor: GOLD, lightingModel: 'Constant' },
  harlemStreetGoldDim: { diffuseColor: GOLD_DIM, lightingModel: 'Constant' },
  harlemStreetChevron: { diffuseColor: GOLD, lightingModel: 'Constant', cullMode: 'None' },
  // Lit by the scene's ambient + directional lights, so walls read apart.
  harlemStreetBuilding: { diffuseColor: LIMESTONE, lightingModel: 'Lambert' },
  harlemStreetPanel: { diffuseColor: INK, lightingModel: 'Constant', cullMode: 'None' },
  harlemStreetButton: { diffuseColor: '#2A231A', lightingModel: 'Constant', cullMode: 'None' },
  harlemStreetButtonHover: { diffuseColor: GOLD_DIM, lightingModel: 'Constant', cullMode: 'None' },
});

// Comfort blink for teleport. Viro has no camera fade, so the world root's
// opacity animates to the sky colour and back (ViroAnimations `opacity`,
// ~/viro/components/Animation/ViroAnimations.ts; VRONode multiplies opacity
// down the tree, ~/virocore/ViroRenderer/VRONode.cpp:363).
ViroAnimations.registerAnimations({
  harlemStreetFadeOut: { properties: { opacity: 0 }, duration: FADE_MS, easing: 'EaseIn' },
  harlemStreetFadeIn: { properties: { opacity: 1 }, duration: FADE_MS, easing: 'EaseOut' },
});

interface Jump {
  readonly user: EnuGround;
  readonly headingDeg?: number;
  /** Runs when the teleport lands, behind the blink. */
  readonly onLand?: () => void;
}

const raster = (() => {
  const token = mapboxToken();
  return token.kind === 'public' ? new MapboxRasterClient({ accessToken: token.token }) : null;
})();

/**
 * Harlem at 1:1 in VR (decision S19). The wearer stands at the selected place
 * among the real buildings (Mapbox Streets v8, extruded) on satellite ground,
 * with gold pillars at every mapped place. Clicking the ground teleports; two
 * buttons snap-turn 45 degrees. "Route here" asks for a walking route from
 * where the wearer stands to the selected place; Next and Previous then
 * teleport turn by turn. Nothing moves without input: every move is a
 * teleport of the world root behind a short blink, never camera motion.
 */
export function HarlemStreetScene() {
  const requestedPlaceId = useArSession((s) => s.requested?.placeId);
  const routeState = useArSession((s) => s.route);
  const pose = useArSession((s) => s.street);
  const { view: navigation, commands } = useStreetNavigation();
  const selectedPlaceId = useExplore((s) => s.selectedPlaceId);
  const map = useStreetMap();
  const [fade, setFade] = useState<{ phase: 'idle' | 'out' | 'in'; to: Jump | null }>({
    phase: 'idle',
    to: null,
  });

  const originPlace = getHarlemPlacePreview(requestedPlaceId ?? selectedPlaceId);
  const origin = useMemo(
    () => (originPlace?.lngLat ? tabletopOrigin(originPlace) : null),
    [originPlace],
  );
  const pillars = useMemo(() => (origin ? streetPillars(origin, MAPPED_PLACES) : []), [origin]);
  const bounds = useMemo(() => streetBounds(pillars, BOUNDS_MARGIN_M), [pillars]);
  const grid = useMemo(() => groundGrid(bounds, GRID_SPACING_M, GRID_LIFT_M), [bounds]);
  const root = worldRootTransform(pose.user, pose.headingDeg);
  const selected = getHarlemPlacePreview(selectedPlaceId);
  const selectedPillar = pillars.find((p) => p.id === selectedPlaceId);

  const route =
    navigation.status === 'routeReady' || navigation.status === 'navigating' || navigation.status === 'paused'
      ? navigation
      : null;
  const legs = route?.legs;
  const steps = useMemo(() => (origin && legs ? navSteps(origin, legs) : []), [origin, legs]);
  const stepIndex = route?.stepIndex ?? 0;
  const guiding = navigation.status === 'navigating' || navigation.status === 'paused';
  const current = guiding ? steps[stepIndex] : undefined;
  const nextStep = guiding ? steps[stepIndex + 1] : undefined;
  // The wearer stands short of the current step's manoeuvre (stanceForStep),
  // so that is the turn to mark; chevrons then run along the street after it.
  const turnAhead = current && current.kind !== 'depart' && current.kind !== 'arrive' ? current : undefined;
  const chevrons = useMemo(() => (current ? chevronMesh(current.path, CHEVRON_LIFT_M) : null), [current]);
  const tabletopRoute = routeState.status === 'ready' ? routeState.route : null;
  const imageryOn = raster !== null && map.imageryTiles.length > 0;

  const groundWidth = bounds.maxEastM - bounds.minEastM;
  const groundDepth = bounds.maxNorthM - bounds.minNorthM;
  const groundCenter: Vec3 = [
    (bounds.minEastM + bounds.maxEastM) / 2,
    0,
    -(bounds.minNorthM + bounds.maxNorthM) / 2,
  ];

  const jump = (to: Jump) => {
    if (fade.phase !== 'idle') return;
    setFade({ phase: 'out', to });
  };

  const onGroundClick = (position: number[]) => {
    const to = teleportTarget(position, pose.user, pose.headingDeg, bounds);
    if (to) jump({ user: to });
  };

  const goToSelected = () => {
    if (!selectedPillar) return;
    jump({
      user: { eastM: selectedPillar.eastM + PLACE_STANCE.eastM, northM: selectedPillar.northM + PLACE_STANCE.northM },
      headingDeg: 0,
    });
  };

  const routeToSelected = () => {
    if (!origin || !selectedPlaceId) return;
    const here = unprojectFromEnu(origin, { eastM: pose.user.eastM, northM: pose.user.northM, upM: 0 });
    const manual: ManualOrigin = {
      kind: 'manual',
      coordinate: { latitude: here.latitude, longitude: here.longitude },
      label: manualOriginLabel(pose.user, pillars),
    };
    commands.requestRoute({ destinationId: selectedPlaceId, origin: manual });
  };

  // The session's step index never moves the wearer by itself: only these
  // presses teleport, so another surface advancing the session cannot slide
  // the wearer's view.
  const goToStep = (index: number) => {
    const target = steps[index];
    if (!target || fade.phase !== 'idle') return;
    // The session moves to the step when the wearer lands there, so the
    // panel and chevrons never show a step the wearer is not standing at.
    jump({ ...stanceForStep(target), onLand: () => commands.goToStep(index) });
  };

  const startGuidance = () => {
    const first = steps[0];
    if (!first || fade.phase !== 'idle') return;
    jump({ ...stanceForStep(first), onLand: () => commands.start() });
  };

  const exitToExplore = () => {
    // Same path as the hardware back button: the intent's onExitViro (which
    // replaces the route with Explore), then finish VRActivity
    // (~/viro/components/Studio/StudioQuestSceneHudOverlay.tsx:72-78).
    VRQuestNavigatorBridge.getIntent()?.rendererConfig?.onExitViro?.();
    exitVRScene();
  };

  const lines = panelLines({
    view: navigation,
    step: stepLines(steps, stepIndex),
    routeSummary: `${steps.length} steps · ${formatDistance(routeDistanceM(steps))}`,
    placeName: selected?.name,
    placeDetail: selected ? `${selected.category} · ${selected.area}` : undefined,
    hasOrigin: origin !== null,
    mapStatus: map.status,
    estimatedHeights: estimatedHeightCount(map.meshes),
  });

  return (
    <ViroScene>
      <ViroSkyBox color={SKY} />
      {/* Lambert buildings need light: a soft fill plus a low sun from the
          south-west so facing walls read differently. */}
      <ViroAmbientLight color="#FFFFFF" intensity={450} />
      <ViroDirectionalLight color="#FFF4E0" direction={[0.45, -0.7, -0.55]} intensity={700} />

      <ViroNode
        position={root.position}
        rotation={root.rotation}
        animation={{
          name: fade.phase === 'out' ? 'harlemStreetFadeOut' : 'harlemStreetFadeIn',
          run: fade.phase !== 'idle',
          loop: false,
          onFinish: () => {
            if (fade.phase === 'out') {
              if (fade.to) {
                useArSession.getState().teleport(fade.to.user, fade.to.headingDeg);
                fade.to.onLand?.();
              }
              setFade({ phase: 'in', to: null });
            } else {
              setFade({ phase: 'idle', to: null });
            }
          },
        }}
      >
        {origin ? (
          <>
            <ViroQuad
              position={groundCenter}
              rotation={[-90, 0, 0]}
              width={groundWidth}
              height={groundDepth}
              materials={['harlemStreetGround']}
              onClick={onGroundClick}
            />
            {imageryOn && raster ? (
              <MapboxViroGround
                origin={origin}
                tiles={map.imageryTiles}
                tileUrl={(tile) => raster.satelliteTileUrl(tile, { format: 'jpg90' })}
                liftM={IMAGERY_LIFT_M}
                quadProps={{ onClick: onGroundClick }}
              />
            ) : (
              grid.map((points, i) =>
                points.length >= 2 ? (
                  <ViroPolyline
                    key={`grid-${i}`}
                    points={points as Vec3[]}
                    thickness={GRID_THICKNESS_M}
                    materials={['harlemStreetGrid']}
                  />
                ) : null,
              )
            )}

            {map.meshes.map((mesh) => (
              <MapboxViroBuildings
                key={`${mesh.tile.z}/${mesh.tile.x}/${mesh.tile.y}`}
                mesh={mesh}
                materials="harlemStreetBuilding"
              />
            ))}

            {route ? (
              <ViroNode position={[0, ROUTE_LIFT_M, 0]}>
                <MapboxViroRoute
                  route={route.geometry}
                  origin={origin}
                  fallbackAltitude={DIORAMA_ALTITUDE_M}
                  thickness={ROUTE_THICKNESS_M}
                  materials="harlemStreetGold"
                />
              </ViroNode>
            ) : tabletopRoute ? (
              <ViroNode position={[0, ROUTE_LIFT_M, 0]}>
                <MapboxViroRoute
                  route={tabletopRoute.coordinates}
                  origin={origin}
                  fallbackAltitude={DIORAMA_ALTITUDE_M}
                  thickness={ROUTE_THICKNESS_M}
                  materials={tabletopRoute.kind === 'walking' ? 'harlemStreetGold' : 'harlemStreetGoldDim'}
                />
              </ViroNode>
            ) : null}

            {chevrons && chevrons.indices.length > 0 ? <GroundMeshView mesh={chevrons} material="harlemStreetChevron" /> : null}
            {turnAhead ? (
              <ViroPolyline
                points={turnIndicator(turnAhead, TURN_LIFT_M) as Vec3[]}
                thickness={TURN_THICKNESS_M}
                materials={['harlemStreetGold']}
              />
            ) : null}
            {current && nextStep ? (
              <ViroNode
                position={[nextStep.at.eastM, BADGE_HEIGHT_M, -nextStep.at.northM]}
                scale={[0.3, 0.3, 0.3]}
                transformBehaviors={['billboardY']}
              >
                <ViroQuad width={2.6} height={0.7} materials={['harlemStreetPanel']} position={[0, 0, -0.01]} />
                <ViroText
                  text={nextStep.kind === 'arrive' ? `Arrive · ${formatDistance(current.distanceToNextM)}` : formatDistance(current.distanceToNextM)}
                  width={2.4}
                  height={0.6}
                  style={{ fontSize: LABEL_FONT_PT, color: GOLD, textAlign: 'center', textAlignVertical: 'center' }}
                />
              </ViroNode>
            ) : null}

            {pillars.map((pillar) => {
              const isSelected = pillar.id === selectedPlaceId;
              const labelScale = labelScaleForDistance(groundDistanceM(pillar, pose.user));
              return (
                <ViroNode
                  key={pillar.id}
                  position={pillar.position as Vec3}
                  onClick={() => useExplore.getState().selectPlace(pillar.id)}
                >
                  <ViroBox
                    position={[0, PILLAR_HEIGHT_M / 2, 0]}
                    width={PILLAR_WIDTH_M}
                    height={PILLAR_HEIGHT_M}
                    length={PILLAR_WIDTH_M}
                    materials={[isSelected ? 'harlemStreetGold' : 'harlemStreetGoldDim']}
                  />
                  <ViroNode
                    position={[0, labelHeightM(groundDistanceM(pillar, pose.user)) + 0.35 * labelScale, 0]}
                    scale={[labelScale, labelScale, labelScale]}
                    transformBehaviors={['billboardY']}
                  >
                    <ViroQuad width={4.6} height={0.7} materials={['harlemStreetPanel']} position={[0, 0, -0.01]} />
                    <ViroText
                      text={pillar.name}
                      width={4.4}
                      height={0.6}
                      style={{
                        fontSize: LABEL_FONT_PT,
                        color: isSelected ? GOLD : PAPER,
                        textAlign: 'center',
                        textAlignVertical: 'center',
                      }}
                    />
                  </ViroNode>
                </ViroNode>
              );
            })}
          </>
        ) : null}
      </ViroNode>

      {/* Scene-fixed, outside the world root: it stays in front after a
          teleport or a turn, at a fixed distance, never head-locked. */}
      <ViroNode position={PANEL_POSITION} rotation={PANEL_ROTATION}>
        <ViroQuad width={PANEL_W_M} height={PANEL_H_M} materials={['harlemStreetPanel']} position={[0, 0, -0.005]} />
        <ViroText
          text={lines.title}
          position={[0, 0.22, 0]}
          scale={PANEL_TEXT_SCALE}
          width={8.4}
          height={0.8}
          style={{ fontSize: 24, color: GOLD, textAlign: 'center', textAlignVertical: 'center' }}
        />
        <ViroText
          text={lines.detail}
          position={[0, 0.15, 0]}
          scale={PANEL_TEXT_SCALE}
          width={8.4}
          height={0.5}
          style={{ fontSize: 20, color: PAPER, textAlign: 'center', textAlignVertical: 'center' }}
        />
        <ViroText
          text={lines.status}
          position={[0, 0.095, 0]}
          scale={PANEL_TEXT_SCALE}
          width={8.4}
          height={0.5}
          style={{ fontSize: 18, color: PAPER, textAlign: 'center', textAlignVertical: 'center' }}
        />
        <PanelButton x={BUTTON_COLUMNS[0]} y={0.02} label="Turn left" onPress={() => useArSession.getState().snapTurn('left')} />
        <PanelButton x={BUTTON_COLUMNS[1]} y={0.02} label="Turn right" onPress={() => useArSession.getState().snapTurn('right')} />
        <PanelButton x={BUTTON_COLUMNS[2]} y={0.02} label="Back to Explore" onPress={exitToExplore} />
        <NavigationButtons
          status={navigation.status}
          canGoBack={stepIndex > 0}
          canGoForward={stepIndex < steps.length - 1}
          hasPlace={selectedPillar !== undefined}
          onGoThere={goToSelected}
          onRouteHere={routeToSelected}
          onStart={startGuidance}
          onPrevious={() => goToStep(stepIndex - 1)}
          onNext={() => goToStep(stepIndex + 1)}
          onEnd={() => commands.end()}
        />
        <ViroText
          text={lines.attribution}
          position={[0, -0.215, 0]}
          scale={[0.07, 0.07, 0.07]}
          width={12}
          height={0.4}
          style={{ fontSize: 16, color: PAPER, textAlign: 'center', textAlignVertical: 'center' }}
        />
      </ViroNode>
    </ViroScene>
  );
}

const ROW_2_Y = -0.09;

function NavigationButtons(props: {
  status: ReturnType<typeof useStreetNavigation>['view']['status'];
  canGoBack: boolean;
  canGoForward: boolean;
  hasPlace: boolean;
  onGoThere: () => void;
  onRouteHere: () => void;
  onStart: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onEnd: () => void;
}) {
  const [left, middle, right] = BUTTON_COLUMNS;
  switch (props.status) {
    case 'navigating':
    case 'paused':
      return (
        <>
          <PanelButton x={left} y={ROW_2_Y} label="Previous" disabled={!props.canGoBack} onPress={props.onPrevious} />
          <PanelButton x={middle} y={ROW_2_Y} label="Next" disabled={!props.canGoForward} onPress={props.onNext} />
          <PanelButton x={right} y={ROW_2_Y} label="End route" onPress={props.onEnd} />
        </>
      );
    case 'routeReady':
      return (
        <>
          <PanelButton x={left} y={ROW_2_Y} label="Start" onPress={props.onStart} />
          <PanelButton x={right} y={ROW_2_Y} label="End route" onPress={props.onEnd} />
        </>
      );
    case 'calculatingRoute':
    case 'rerouting':
      return <PanelButton x={middle} y={ROW_2_Y} label="Cancel" onPress={props.onEnd} />;
    case 'arrived':
      return <PanelButton x={middle} y={ROW_2_Y} label="Done" onPress={props.onEnd} />;
    case 'unavailable':
      // No session: moving between places still works.
      return props.hasPlace ? <PanelButton x={left} y={ROW_2_Y} label="Go there" onPress={props.onGoThere} /> : null;
    default:
      return props.hasPlace ? (
        <>
          <PanelButton x={left} y={ROW_2_Y} label="Go there" onPress={props.onGoThere} />
          <PanelButton x={middle} y={ROW_2_Y} label="Route here" onPress={props.onRouteHere} />
        </>
      ) : null;
  }
}

/** A flat mesh on the ground (chevrons): one ViroGeometry, one draw call. */
function GroundMeshView({ mesh, material }: { mesh: GroundMesh; material: string }) {
  // ViroGeometry's native side reads triangleIndices as one flat int list per
  // submesh (~/viro/android/viro_bridge/.../VRTGeometryManager.java:101-118),
  // though ViroGeometry.tsx types it as Viro3DPoint[].
  const triangleIndices = useMemo(
    () => [mesh.indices] as unknown as ComponentProps<typeof ViroGeometry>['triangleIndices'],
    [mesh],
  );
  return (
    <ViroGeometry
      vertices={mesh.vertices}
      normals={mesh.normals}
      texcoords={mesh.texcoords}
      triangleIndices={triangleIndices}
      materials={[material]}
    />
  );
}

function PanelButton({
  x,
  y,
  label,
  onPress,
  disabled = false,
}: {
  x: number;
  y: number;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const lit = hover && !disabled;
  return (
    <ViroNode
      position={[x, y, 0]}
      onClick={() => {
        if (!disabled) onPress();
      }}
      onHover={(isHovering: boolean) => setHover(isHovering)}
    >
      <ViroQuad
        width={BUTTON_W_M}
        height={BUTTON_H_M}
        materials={[lit ? 'harlemStreetButtonHover' : 'harlemStreetButton']}
        position={[0, 0, -0.002]}
      />
      <ViroText
        text={label}
        scale={PANEL_TEXT_SCALE}
        width={2.5}
        height={0.7}
        style={{
          fontSize: 20,
          color: lit ? INK : disabled ? GOLD_DIM : PAPER,
          textAlign: 'center',
          textAlignVertical: 'center',
        }}
      />
    </ViroNode>
  );
}
