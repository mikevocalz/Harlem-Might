import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ViroARPlaneSelector,
  ViroARScene,
  ViroAmbientLight,
  ViroBox,
  ViroMaterials,
  ViroNode,
  ViroQuad,
  ViroSphere,
  ViroText,
  getOpenXRRuntimeCapabilities,
  isMetaHorizonXR,
  useVRViewTag,
} from '@reactvision/react-viro';
import {
  MapboxViroRoute,
  pointAlongRoute,
  projectRouteToEnu,
  projectToEnu,
  routeLengthM,
} from '@mapbox/react-native-mapbox-ar-reactvision';
import { MAPPED_PLACES, getHarlemPlacePreview, useExplore } from '@acme/app';
import { acceptsGameSurface } from '@acme/spatial/arSurface';
import { palette } from '@acme/theme';
import { resolveArMode } from './arMode';
import { useArSession } from './arSession.store';
import {
  DIORAMA_ALTITUDE_M,
  fitTabletopScale,
  placeEnuExtent,
  planeLocalFromWorld,
  tabletopOrigin,
} from './arTabletop';

type Vec3 = [number, number, number];

/** How long to wait for a room-model table before offering the floor. */
const FLOOR_FALLBACK_DELAY_MS = 6000;
/** Smallest plane the diorama is offered on (metres). */
const MIN_PLANE_WIDTH_M = 0.5;
const MIN_PLANE_DEPTH_M = 0.4;
/** Table-space sizes, in metres. */
const PIN_HEAD_RADIUS_M = 0.02;
const PIN_STEM_HEIGHT_M = 0.035;
const BASE_LIFT_M = 0.002;
const ROUTE_LIFT_M = 0.004;
const SCRUBBER_GAP_M = 0.06;
/** Route width on the ground, in world metres (4 mm at 1:2000). */
const ROUTE_WIDTH_WORLD_M = 8;
/**
 * ViroText renders about 1.2 cm per point at scale 1. At 0.1 a 22 pt line is
 * about 2.6 cm tall, one degree of visual angle at 1.5 m.
 */
const TEXT_SCALE: Vec3 = [0.1, 0.1, 0.1];

const GOLD = palette.mights.gold;
const GOLD_DIM = palette.mights['gold-dim'];
const INK = palette.mights['warm-black'];
const PAPER = palette.mights.paper;

ViroMaterials.createMaterials({
  harlemTablePlane: {
    diffuseColor: 'rgba(248,198,38,0.16)',
    lightingModel: 'Constant',
    blendMode: 'Alpha',
    cullMode: 'None',
  },
  harlemTableBase: { diffuseColor: INK, lightingModel: 'Constant', cullMode: 'None' },
  harlemPanel: { diffuseColor: INK, lightingModel: 'Constant', cullMode: 'None' },
  harlemGold: { diffuseColor: GOLD, lightingModel: 'Constant' },
  harlemGoldDim: { diffuseColor: GOLD_DIM, lightingModel: 'Constant' },
  harlemPaper: { diffuseColor: PAPER, lightingModel: 'Constant' },
});

interface SelectedPlane {
  readonly anchorId: string;
  readonly surface: 'Table' | 'Floor';
  readonly widthM: number;
  readonly depthM: number;
  /** Plane-local tap point, where ViroARPlaneSelector seats its children. */
  readonly tapLocal: Vec3;
  readonly anchorPosition: Vec3;
  readonly anchorRotation: Vec3;
}

interface Capabilities {
  readonly passthroughAvailable: boolean;
  readonly sceneUnderstandingAvailable: boolean;
}

/**
 * Harlem as a diorama on a real table, in passthrough. The room model
 * (Space Setup on Quest) supplies the table; the diorama follows its anchor.
 * Places, the walking route and the playhead come from the stores; selecting
 * a pin writes the same `useExplore` selection the 2D panel reads.
 */
export function HarlemTabletopScene() {
  const selectorRef = useRef<ViroARPlaneSelector>(null);
  const deferredFloors = useRef(new Map<string, any>());
  const tableSeen = useRef(false);
  const [floorAllowed, setFloorAllowed] = useState(false);
  const [plane, setPlane] = useState<SelectedPlane | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const viewTag = useVRViewTag();

  const requestedPlaceId = useArSession((s) => s.requested?.placeId);
  const routeState = useArSession((s) => s.route);
  const playheadM = useArSession((s) => s.playheadM);
  const degraded = useArSession((s) => s.degraded);
  const selectedPlaceId = useExplore((s) => s.selectedPlaceId);

  const originPlace = getHarlemPlacePreview(requestedPlaceId ?? selectedPlaceId);
  const origin = useMemo(
    () => (originPlace?.lngLat ? tabletopOrigin(originPlace) : null),
    [originPlace],
  );
  const extent = useMemo(() => (origin ? placeEnuExtent(origin, MAPPED_PLACES) : null), [origin]);

  // Passthrough and the room model are only readable once the headset view
  // exists (the query needs its view tag).
  useEffect(() => {
    if (viewTag == null) return;
    let cancelled = false;
    getOpenXRRuntimeCapabilities(viewTag).then((caps) => {
      if (!cancelled && caps) setCapabilities(caps);
    });
    return () => {
      cancelled = true;
    };
  }, [viewTag]);

  // Tables first. Floors are held back until no table has shown up for a
  // while, then handed to the selector.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (tableSeen.current) return;
      setFloorAllowed(true);
      for (const floor of deferredFloors.current.values()) {
        selectorRef.current?.handleAnchorFound(floor);
      }
      deferredFloors.current.clear();
    }, FLOOR_FALLBACK_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const worldToTableScale = useMemo(
    () => (extent && plane ? fitTabletopScale(extent, { widthM: plane.widthM, depthM: plane.depthM }) : null),
    [extent, plane],
  );

  // Resolve the mode once a plane is chosen.
  useEffect(() => {
    if (!plane || worldToTableScale == null) return;
    const session = useArSession.getState();
    session.place({
      anchorId: plane.anchorId,
      surface: plane.surface,
      widthM: plane.widthM,
      depthM: plane.depthM,
    });
    const { mode, degraded: events } = resolveArMode(session.requested?.mode ?? 'tabletop', {
      device: isMetaHorizonXR ? 'headset' : 'phone',
      geospatial: 'unavailable',
      tableAnchorId: plane.surface === 'Table' ? plane.anchorId : undefined,
      floorAnchorId: plane.surface === 'Floor' ? plane.anchorId : undefined,
      wallAnchorIds: [],
      worldToTableScale,
      roomRadiusScale: 1 / worldToTableScale,
    });
    session.resolve(mode, events);
  }, [plane, worldToTableScale]);

  const route = routeState.status === 'ready' ? routeState.route : null;
  const projectedRoute = useMemo(
    () =>
      origin && route && route.coordinates.length >= 2
        ? projectRouteToEnu(origin, route.coordinates, { fallbackAltitude: DIORAMA_ALTITUDE_M })
        : null,
    [origin, route],
  );
  const routeLength = projectedRoute ? routeLengthM(projectedRoute) : 0;

  const scale = worldToTableScale ? 1 / worldToTableScale : 0;
  // World-metre centre of the places; the diorama is centred on the tap.
  const center = extent
    ? { east: (extent.minEastM + extent.maxEastM) / 2, north: (extent.minNorthM + extent.maxNorthM) / 2 }
    : { east: 0, north: 0 };
  const toTable = (p: readonly [number, number, number]): Vec3 => [
    (p[0] - center.east) * scale,
    0,
    (p[2] + center.north) * scale,
  ];
  const tableWidth = extent ? (extent.maxEastM - extent.minEastM) * scale : 0;
  const tableDepth = extent ? (extent.maxNorthM - extent.minNorthM) * scale : 0;
  const baseWidth = tableWidth + 0.08;
  const baseDepth = tableDepth + 0.08;
  const scrubberZ = baseDepth / 2 + SCRUBBER_GAP_M;

  const pins = useMemo(() => {
    if (!origin) return [];
    return MAPPED_PLACES.map((place) => {
      const enu = projectToEnu(origin, {
        latitude: place.lngLat![1],
        longitude: place.lngLat![0],
        altitude: DIORAMA_ALTITUDE_M,
      });
      return { place, world: [enu.eastM, enu.upM, -enu.northM] as const };
    });
  }, [origin]);

  const playhead = projectedRoute ? toTable(pointAlongRoute(projectedRoute, playheadM)) : null;
  const playheadFraction = routeLength > 0 ? Math.min(1, playheadM / routeLength) : 0;

  /** Moves the playhead to where a controller or hand dragged on the bar. */
  const scrubTo = (world: readonly number[]) => {
    if (!plane || routeLength <= 0 || world.length < 3) return;
    const local = planeLocalFromWorld([world[0]!, world[1]!, world[2]!], {
      position: plane.anchorPosition,
      rotation: plane.anchorRotation,
    });
    const x = local[0] - plane.tapLocal[0];
    const fraction = Math.min(1, Math.max(0, (x + tableWidth / 2) / tableWidth));
    useArSession.getState().setPlayheadM(fraction * routeLength);
  };

  const status = statusLine({
    capabilities,
    placed: plane !== null,
    floorAllowed,
    surface: plane?.surface,
    degradedReasons: degraded.map((event) => event.reason),
    route,
    loading: routeState.status === 'loading',
  });

  return (
    <ViroARScene
      anchorDetectionTypes="planesHorizontal"
      onAnchorFound={(anchor: any) => {
        if (anchor?.type === 'plane' && anchor.classification === 'Table') tableSeen.current = true;
        if (anchor?.classification === 'Floor' && !floorAllowed) {
          deferredFloors.current.set(anchor.anchorId, anchor);
          return;
        }
        selectorRef.current?.handleAnchorFound(anchor);
      }}
      onAnchorUpdated={(anchor: any) => selectorRef.current?.handleAnchorUpdated(anchor)}
      onAnchorRemoved={(anchor: any) => {
        if (!anchor) return;
        deferredFloors.current.delete(anchor.anchorId);
        selectorRef.current?.handleAnchorRemoved(anchor);
        if (plane?.anchorId === anchor.anchorId) setPlane(null);
      }}
    >
      <ViroAmbientLight color="#ffffff" intensity={200} />

      {/* Status: an opaque card, never text over passthrough. */}
      <ViroNode position={[0, 1.45, -1.5]} transformBehaviors={['billboardY']}>
        <ViroQuad width={0.9} height={0.16} materials={['harlemPanel']} position={[0, 0, -0.005]} />
        <ViroText
          text={status}
          scale={TEXT_SCALE}
          width={8.4}
          height={1.4}
          style={{ fontSize: 22, color: PAPER, textAlign: 'center', textAlignVertical: 'center' }}
        />
      </ViroNode>

      <ViroARPlaneSelector
        ref={selectorRef}
        alignment="Horizontal"
        minWidth={MIN_PLANE_WIDTH_M}
        minHeight={MIN_PLANE_DEPTH_M}
        material="harlemTablePlane"
        useActualShape
        onPlaneDetected={(detected: any) => acceptsGameSurface(detected, isMetaHorizonXR)}
        onPlaneSelected={(selected: any, tapWorld?: Vec3) => {
          const anchorPosition = (selected.position ?? [0, 0, 0]) as Vec3;
          const anchorRotation = (selected.rotation ?? [0, 0, 0]) as Vec3;
          const tap = tapWorld ? planeLocalFromWorld(tapWorld, { position: anchorPosition, rotation: anchorRotation }) : [0, 0, 0];
          setPlane({
            anchorId: selected.anchorId,
            surface: selected.classification === 'Floor' ? 'Floor' : 'Table',
            widthM: selected.width ?? MIN_PLANE_WIDTH_M,
            depthM: selected.height ?? MIN_PLANE_DEPTH_M,
            tapLocal: [tap[0], 0, tap[2]],
            anchorPosition,
            anchorRotation,
          });
        }}
        onPlaneRemoved={(anchorId: string) => {
          if (plane?.anchorId === anchorId) setPlane(null);
        }}
      >
        {origin && worldToTableScale ? (
          <ViroNode position={[0, BASE_LIFT_M, 0]}>
            <ViroQuad
              rotation={[-90, 0, 0]}
              width={baseWidth}
              height={baseDepth}
              materials={['harlemTableBase']}
            />

            {/* The route in world metres, scaled down to the table. */}
            {route ? (
              <ViroNode
                position={[-center.east * scale, ROUTE_LIFT_M, center.north * scale]}
                scale={[scale, scale, scale]}
              >
                <MapboxViroRoute
                  route={route.coordinates}
                  origin={origin}
                  fallbackAltitude={DIORAMA_ALTITUDE_M}
                  thickness={ROUTE_WIDTH_WORLD_M}
                  materials={route.kind === 'walking' ? 'harlemGold' : 'harlemGoldDim'}
                />
              </ViroNode>
            ) : null}

            {pins.map(({ place, world }) => {
              const position = toTable(world);
              const selected = place.id === selectedPlaceId;
              return (
                <ViroNode
                  key={place.id}
                  position={position}
                  onClick={() => useExplore.getState().selectPlace(place.id)}
                >
                  <ViroBox
                    position={[0, PIN_STEM_HEIGHT_M / 2, 0]}
                    width={0.004}
                    height={PIN_STEM_HEIGHT_M}
                    length={0.004}
                    materials={['harlemGoldDim']}
                  />
                  <ViroSphere
                    position={[0, PIN_STEM_HEIGHT_M + PIN_HEAD_RADIUS_M, 0]}
                    radius={selected ? PIN_HEAD_RADIUS_M * 1.25 : PIN_HEAD_RADIUS_M}
                    materials={[selected ? 'harlemGold' : 'harlemGoldDim']}
                  />
                  {selected ? (
                    <ViroNode
                      position={[0, PIN_STEM_HEIGHT_M + PIN_HEAD_RADIUS_M * 2 + 0.06, 0]}
                      transformBehaviors={['billboardY']}
                    >
                      <ViroQuad width={0.36} height={0.07} materials={['harlemPanel']} position={[0, 0, -0.003]} />
                      <ViroText
                        text={place.name}
                        scale={TEXT_SCALE}
                        width={3.4}
                        height={0.6}
                        style={{ fontSize: 22, color: GOLD, textAlign: 'center', textAlignVertical: 'center' }}
                      />
                    </ViroNode>
                  ) : null}
                </ViroNode>
              );
            })}

            {playhead ? (
              <ViroSphere
                position={[playhead[0], ROUTE_LIFT_M + 0.008, playhead[2]]}
                radius={0.008}
                materials={['harlemPaper']}
              />
            ) : null}

            {/* Scrubber: drag (controller or pinch) or click along the bar. */}
            {route && routeLength > 0 ? (
              <ViroNode position={[0, 0.01, scrubberZ]}>
                <ViroNode
                  dragType="FixedDistance"
                  dragTransform="none"
                  onDrag={(dragTo: number[]) => scrubTo(dragTo)}
                  onClick={(position: number[]) => scrubTo(position)}
                >
                  <ViroBox width={tableWidth} height={0.012} length={0.05} materials={['harlemPanel']} />
                </ViroNode>
                <ViroBox
                  position={[-tableWidth / 2 + (tableWidth * playheadFraction) / 2, 0.007, 0]}
                  width={Math.max(0.001, tableWidth * playheadFraction)}
                  height={0.004}
                  length={0.02}
                  materials={['harlemGold']}
                />
                <ViroSphere
                  position={[-tableWidth / 2 + tableWidth * playheadFraction, 0.012, 0]}
                  radius={0.016}
                  materials={['harlemGold']}
                />
              </ViroNode>
            ) : null}
          </ViroNode>
        ) : null}
      </ViroARPlaneSelector>
    </ViroARScene>
  );
}

function statusLine(input: {
  capabilities: Capabilities | null;
  placed: boolean;
  floorAllowed: boolean;
  surface: 'Table' | 'Floor' | undefined;
  degradedReasons: readonly string[];
  route: { kind: 'walking' | 'straight'; reason?: string } | null;
  loading: boolean;
}): string {
  if (input.capabilities && !input.capabilities.passthroughAvailable) {
    return 'Passthrough is unavailable on this headset';
  }
  if (input.capabilities && !input.capabilities.sceneUnderstandingAvailable) {
    return 'No room model. Run Space Setup and mark a table';
  }
  if (!input.placed) {
    return input.floorAllowed ? 'No table found. Point at the floor and select' : 'Point at a table and select';
  }
  const surface = input.degradedReasons.includes('no-table-anchor') ? 'On the floor (no table found)' : 'On the table';
  if (input.loading) return `${surface} · Finding a walking route`;
  if (!input.route) return surface;
  if (input.route.kind === 'straight') return `${surface} · Straight lines, not a walking route`;
  return `${surface} · Walking route to nearby places`;
}
