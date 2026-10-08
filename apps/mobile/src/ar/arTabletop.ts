import type { EnuOrigin } from '@mapbox/react-native-mapbox-ar-reactvision/src/types.ts';
import { projectToEnu } from '@mapbox/react-native-mapbox-ar-reactvision/src/enu.ts';

/** A place as the diorama reads it: `lngLat` is `[longitude, latitude]`. */
export interface TabletopPlace {
  readonly id: string;
  readonly lngLat?: readonly [number, number];
}

/**
 * Altitude for the origin and every place. Places carry no altitude, and the
 * diorama is flat, so one shared value keeps every marker at y = 0. Earth
 * curvature over Harlem's 1.2 km is about 0.11 m, under 0.1 mm on the table.
 */
export const DIORAMA_ALTITUDE_M = 0;

/** Most detailed scale: 1 m of table shows 1.5 km of Harlem. */
export const MIN_WORLD_TO_TABLE_SCALE = 1500;
/** Least detailed scale: 1 m of table shows 4 km of Harlem. */
export const MAX_WORLD_TO_TABLE_SCALE = 4000;

const origins = new Map<string, EnuOrigin>();

/**
 * The ENU origin for a diorama centred on a place. The same place returns the
 * same object, so components that re-project on a new origin (MapboxViroRoute)
 * do not re-project on every render.
 *
 * @throws {Error} When the place has no coordinates.
 */
export function tabletopOrigin(place: TabletopPlace): EnuOrigin {
  const cached = origins.get(place.id);
  if (cached) return cached;
  if (!place.lngLat) throw new Error(`Place ${place.id} has no coordinates`);
  const origin: EnuOrigin = {
    frame: { kind: 'place', placeId: place.id },
    latitude: place.lngLat[1],
    longitude: place.lngLat[0],
    altitude: DIORAMA_ALTITUDE_M,
  };
  origins.set(place.id, origin);
  return origin;
}

/** East/north bounds, in metres from an origin, of a set of places. */
export interface EnuExtent {
  readonly minEastM: number;
  readonly maxEastM: number;
  readonly minNorthM: number;
  readonly maxNorthM: number;
}

/** WGS84 ENU bounds of every place with coordinates, the origin included. */
export function placeEnuExtent(origin: EnuOrigin, places: readonly TabletopPlace[]): EnuExtent {
  let minEastM = 0;
  let maxEastM = 0;
  let minNorthM = 0;
  let maxNorthM = 0;
  for (const place of places) {
    if (!place.lngLat) continue;
    const offset = projectToEnu(origin, {
      latitude: place.lngLat[1],
      longitude: place.lngLat[0],
      altitude: DIORAMA_ALTITUDE_M,
    });
    minEastM = Math.min(minEastM, offset.eastM);
    maxEastM = Math.max(maxEastM, offset.eastM);
    minNorthM = Math.min(minNorthM, offset.northM);
    maxNorthM = Math.max(maxNorthM, offset.northM);
  }
  return { minEastM, maxEastM, minNorthM, maxNorthM };
}

/**
 * Metres of real world per metre of table (`ArMode` tabletop
 * `worldToTableScale`) that fits `extent` on the plane with `margin` to
 * spare. East runs along the plane's width, north along its depth. The result
 * is clamped to {@linkcode MIN_WORLD_TO_TABLE_SCALE} ..
 * {@linkcode MAX_WORLD_TO_TABLE_SCALE}; past the upper clamp the diorama
 * overhangs a very small plane.
 *
 * @throws {RangeError} When a plane size is not positive or `margin` is not
 * in (0, 1].
 */
export function fitTabletopScale(
  extent: EnuExtent,
  plane: { readonly widthM: number; readonly depthM: number },
  margin = 0.85,
): number {
  if (!(plane.widthM > 0) || !(plane.depthM > 0)) {
    throw new RangeError('Plane width and depth must be positive');
  }
  if (!(margin > 0 && margin <= 1)) throw new RangeError('margin must be in (0, 1]');
  const fit = Math.max(
    (extent.maxEastM - extent.minEastM) / (plane.widthM * margin),
    (extent.maxNorthM - extent.minNorthM) / (plane.depthM * margin),
  );
  return Math.min(MAX_WORLD_TO_TABLE_SCALE, Math.max(MIN_WORLD_TO_TABLE_SCALE, fit));
}

type Vec3 = readonly [number, number, number];

/**
 * Converts a world point into a plane anchor's local frame: x across the
 * plane, y off its surface, z along it. Same rotation order as Viro's
 * `ViroARPlaneSelector` (R = Rx·Ry·Rz from the anchor's Euler degrees;
 * local = Rᵀ·(world − position)), which is not exported by Viro.
 */
export function planeLocalFromWorld(
  world: Vec3,
  anchor: { readonly position: Vec3; readonly rotation: Vec3 },
): [number, number, number] {
  const toRad = Math.PI / 180;
  const [rx, ry, rz] = anchor.rotation;
  const c1 = Math.cos(rx * toRad), s1 = Math.sin(rx * toRad);
  const c2 = Math.cos(ry * toRad), s2 = Math.sin(ry * toRad);
  const c3 = Math.cos(rz * toRad), s3 = Math.sin(rz * toRad);
  const dx = world[0] - anchor.position[0];
  const dy = world[1] - anchor.position[1];
  const dz = world[2] - anchor.position[2];
  return [
    c2 * c3 * dx + (s1 * s2 * c3 + c1 * s3) * dy + (-c1 * s2 * c3 + s1 * s3) * dz,
    -c2 * s3 * dx + (-s1 * s2 * s3 + c1 * c3) * dy + (c1 * s2 * s3 + s1 * c3) * dz,
    s2 * dx + -s1 * c2 * dy + c1 * c2 * dz,
  ];
}
