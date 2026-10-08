import { useMemo, useState } from 'react';
import {
  VRQuestNavigatorBridge,
  ViroAnimations,
  ViroBox,
  ViroMaterials,
  ViroNode,
  ViroPolyline,
  ViroQuad,
  ViroScene,
  ViroSkyBox,
  ViroText,
  exitVRScene,
} from '@reactvision/react-viro';
import { MapboxViroRoute } from '@mapbox/react-native-mapbox-ar-reactvision';
import { MAPPED_PLACES, getHarlemPlacePreview, useExplore } from '@acme/app';
import { palette } from '@acme/theme';
import { DIORAMA_ALTITUDE_M, tabletopOrigin } from './arTabletop';
import { useArSession } from './arSession.store';
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
/** The walking route as a ribbon on the sidewalk. */
const ROUTE_LIFT_M = 0.04;
const ROUTE_THICKNESS_M = 0.6;
const PILLAR_WIDTH_M = 0.6;
const PILLAR_HEIGHT_M = 3;
/** Scene-fixed control panel: below eye line, inside 1.0 to 2.0 m. */
const PANEL_POSITION: Vec3 = [0, 1.05, -1.25];
const PANEL_ROTATION: Vec3 = [-20, 0, 0];
/** 22 pt at 0.1 is about 2.6 cm, one degree at 1.5 m (HarlemTabletopScene). */
const PANEL_TEXT_SCALE: Vec3 = [0.1, 0.1, 0.1];
/** Buttons are 26 x 8 cm: above Meta's 48 mm ray and 64 mm pinch minimums. */
const BUTTON_W_M = 0.26;
const BUTTON_H_M = 0.08;
const FADE_MS = 120;

const GOLD = palette.mights.gold;
const GOLD_DIM = palette.mights['gold-dim'];
const INK = palette.mights['warm-black'];
const PAPER = palette.mights.paper;
/** A night sky a step above the ground, so the horizon stays visible. */
const SKY = '#1A1510';

ViroMaterials.createMaterials({
  harlemStreetGround: { diffuseColor: INK, lightingModel: 'Constant', cullMode: 'None' },
  harlemStreetGrid: { diffuseColor: '#3A2F1C', lightingModel: 'Constant' },
  harlemStreetGold: { diffuseColor: GOLD, lightingModel: 'Constant' },
  harlemStreetGoldDim: { diffuseColor: GOLD_DIM, lightingModel: 'Constant' },
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

/**
 * Harlem at 1:1 in VR (decision S19, slice 1). The wearer stands at the
 * selected place on a dark ground with a 25 m grid, gold pillars at every
 * mapped place and the walking route on the sidewalk. Clicking the ground
 * teleports; two buttons snap-turn 45 degrees. Nothing moves without input:
 * teleport and turn move the world root, never the camera.
 */
export function HarlemStreetScene() {
  const requestedPlaceId = useArSession((s) => s.requested?.placeId);
  const routeState = useArSession((s) => s.route);
  const pose = useArSession((s) => s.street);
  const selectedPlaceId = useExplore((s) => s.selectedPlaceId);
  const [fade, setFade] = useState<{ phase: 'idle' | 'out' | 'in'; to: EnuGround | null }>({
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
  const route = routeState.status === 'ready' ? routeState.route : null;
  const selected = getHarlemPlacePreview(selectedPlaceId);

  const groundWidth = bounds.maxEastM - bounds.minEastM;
  const groundDepth = bounds.maxNorthM - bounds.minNorthM;
  const groundCenter: Vec3 = [
    (bounds.minEastM + bounds.maxEastM) / 2,
    0,
    -(bounds.minNorthM + bounds.maxNorthM) / 2,
  ];

  const onGroundClick = (position: number[]) => {
    if (fade.phase !== 'idle') return;
    const to = teleportTarget(position, pose.user, pose.headingDeg, bounds);
    if (to) setFade({ phase: 'out', to });
  };

  const exitToExplore = () => {
    // Same path as the hardware back button: the intent's onExitViro (which
    // replaces the route with Explore), then finish VRActivity
    // (~/viro/components/Studio/StudioQuestSceneHudOverlay.tsx:72-78).
    VRQuestNavigatorBridge.getIntent()?.rendererConfig?.onExitViro?.();
    exitVRScene();
  };

  return (
    <ViroScene>
      <ViroSkyBox color={SKY} />

      <ViroNode
        position={root.position}
        rotation={root.rotation}
        animation={{
          name: fade.phase === 'out' ? 'harlemStreetFadeOut' : 'harlemStreetFadeIn',
          run: fade.phase !== 'idle',
          loop: false,
          onFinish: () => {
            if (fade.phase === 'out') {
              if (fade.to) useArSession.getState().teleport(fade.to);
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
            {grid.map((points, i) =>
              points.length >= 2 ? (
                <ViroPolyline
                  key={`grid-${i}`}
                  points={points as Vec3[]}
                  thickness={GRID_THICKNESS_M}
                  materials={['harlemStreetGrid']}
                />
              ) : null,
            )}

            {route ? (
              <ViroNode position={[0, ROUTE_LIFT_M, 0]}>
                <MapboxViroRoute
                  route={route.coordinates}
                  origin={origin}
                  fallbackAltitude={DIORAMA_ALTITUDE_M}
                  thickness={ROUTE_THICKNESS_M}
                  materials={route.kind === 'walking' ? 'harlemStreetGold' : 'harlemStreetGoldDim'}
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
                    position={[0, PILLAR_HEIGHT_M + 0.2 + 0.35 * labelScale, 0]}
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
        <ViroQuad width={0.9} height={0.42} materials={['harlemStreetPanel']} position={[0, 0, -0.005]} />
        <ViroText
          text={selected?.name ?? (origin ? 'Harlem' : 'This place has no map point')}
          position={[0, 0.15, 0]}
          scale={PANEL_TEXT_SCALE}
          width={8.4}
          height={0.6}
          style={{ fontSize: 24, color: GOLD, textAlign: 'center', textAlignVertical: 'center' }}
        />
        <ViroText
          text={selected ? `${selected.category} · ${selected.area}` : 'Select a pillar to see a place'}
          position={[0, 0.09, 0]}
          scale={PANEL_TEXT_SCALE}
          width={8.4}
          height={0.5}
          style={{ fontSize: 20, color: PAPER, textAlign: 'center', textAlignVertical: 'center' }}
        />
        <ViroText
          text={statusLine(routeState.status, route?.kind)}
          position={[0, 0.035, 0]}
          scale={PANEL_TEXT_SCALE}
          width={8.4}
          height={0.5}
          style={{ fontSize: 18, color: PAPER, textAlign: 'center', textAlignVertical: 'center' }}
        />
        <PanelButton x={-0.29} label="Turn left" onPress={() => useArSession.getState().snapTurn('left')} />
        <PanelButton x={0} label="Turn right" onPress={() => useArSession.getState().snapTurn('right')} />
        <PanelButton x={0.29} label="Back to Explore" onPress={exitToExplore} />
        <ViroText
          text="Route © Mapbox © OpenStreetMap"
          position={[0, -0.18, 0]}
          scale={[0.07, 0.07, 0.07]}
          width={10}
          height={0.4}
          style={{ fontSize: 16, color: PAPER, textAlign: 'center', textAlignVertical: 'center' }}
        />
      </ViroNode>
    </ViroScene>
  );
}

function PanelButton({ x, label, onPress }: { x: number; label: string; onPress: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <ViroNode position={[x, -0.075, 0]} onClick={() => onPress()} onHover={(isHovering: boolean) => setHover(isHovering)}>
      <ViroQuad
        width={BUTTON_W_M}
        height={BUTTON_H_M}
        materials={[hover ? 'harlemStreetButtonHover' : 'harlemStreetButton']}
        position={[0, 0, -0.002]}
      />
      <ViroText
        text={label}
        scale={PANEL_TEXT_SCALE}
        width={2.5}
        height={0.7}
        style={{ fontSize: 20, color: hover ? INK : PAPER, textAlign: 'center', textAlignVertical: 'center' }}
      />
    </ViroNode>
  );
}

function statusLine(status: 'idle' | 'loading' | 'ready', kind: 'walking' | 'straight' | undefined): string {
  if (status === 'loading') return 'Finding a walking route · Click the ground to move';
  if (kind === 'walking') return 'Gold ribbon: walking route to nearby places · Click the ground to move';
  if (kind === 'straight') return 'No walking route, straight lines shown · Click the ground to move';
  return 'Click the ground to move';
}
