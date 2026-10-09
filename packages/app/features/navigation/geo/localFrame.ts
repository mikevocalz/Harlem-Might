import { assertCoordinate, type GeographicCoordinate } from '../model/geo.ts';
import { toDegrees, toRadians } from './angles.ts';

/** Metres east and north of a {@linkcode LocalFrame}'s origin on its tangent plane. */
export interface LocalPoint {
  readonly eastM: number;
  readonly northM: number;
}

/**
 * A local East-North-Up tangent plane at a fixed WGS84 origin, flattened to
 * east/north metres. Route matching, the Kalman filter and arrival all work in
 * one of these, never in degrees or Web Mercator units.
 *
 * The forward math is WGS84 → ECEF → ENU, the same derivation as
 * `projectToEnu` in `@mapbox/react-native-mapbox-ar-reactvision`;
 * `localFrame.test.ts` pins it to values that function produced. Altitude is
 * taken as 0 because street navigation is horizontal; at city scale the
 * difference is under a millimetre in east/north.
 *
 * @see `docs/GEO_COORDINATE_SYSTEMS.md`
 */
export interface LocalFrame {
  readonly origin: GeographicCoordinate;
  toLocal(coordinate: GeographicCoordinate): LocalPoint;
  toGeographic(point: LocalPoint): GeographicCoordinate;
}

const SEMI_MAJOR_AXIS_M = 6378137;
const FLATTENING = 1 / 298.257223563;
const E2 = FLATTENING * (2 - FLATTENING);

type Vec3 = readonly [number, number, number];

function toEcef(latitude: number, longitude: number): Vec3 {
  const lat = toRadians(latitude);
  const lon = toRadians(longitude);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const n = SEMI_MAJOR_AXIS_M / Math.sqrt(1 - E2 * sinLat * sinLat);
  return [n * cosLat * Math.cos(lon), n * cosLat * Math.sin(lon), n * (1 - E2) * sinLat];
}

function fromEcef([x, y, z]: Vec3): GeographicCoordinate {
  const longitude = Math.atan2(y, x);
  const p = Math.hypot(x, y);
  let latitude = Math.atan2(z, p * (1 - E2));
  for (let i = 0; i < 5; i += 1) {
    const sinLat = Math.sin(latitude);
    const n = SEMI_MAJOR_AXIS_M / Math.sqrt(1 - E2 * sinLat * sinLat);
    latitude = Math.atan2(z + E2 * n * sinLat, p);
  }
  return { latitude: toDegrees(latitude), longitude: toDegrees(longitude) };
}

/**
 * Creates a {@linkcode LocalFrame} at `origin`.
 *
 * @throws {RangeError} When `origin` is not a valid WGS84 coordinate.
 */
export function createLocalFrame(origin: GeographicCoordinate): LocalFrame {
  assertCoordinate(origin, 'origin');
  const lat = toRadians(origin.latitude);
  const lon = toRadians(origin.longitude);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinLon = Math.sin(lon);
  const cosLon = Math.cos(lon);
  const [x0, y0, z0] = toEcef(origin.latitude, origin.longitude);
  const frozenOrigin = { latitude: origin.latitude, longitude: origin.longitude };

  return {
    origin: frozenOrigin,
    toLocal(coordinate) {
      assertCoordinate(coordinate);
      const [x, y, z] = toEcef(coordinate.latitude, coordinate.longitude);
      const dx = x - x0;
      const dy = y - y0;
      const dz = z - z0;
      return {
        eastM: -sinLon * dx + cosLon * dy,
        northM: -sinLat * cosLon * dx - sinLat * sinLon * dy + cosLat * dz,
      };
    },
    toGeographic({ eastM, northM }) {
      if (!Number.isFinite(eastM) || !Number.isFinite(northM)) {
        throw new RangeError('eastM and northM must be finite');
      }
      // ENU → ECEF with up = 0 (the point on the tangent plane), then back to
      // geodetic. The tangent-plane point sits slightly above the ellipsoid
      // away from the origin; fromEcef ignores height, so latitude/longitude
      // are those of the point directly below it.
      const dx = -sinLon * eastM - sinLat * cosLon * northM;
      const dy = cosLon * eastM - sinLat * sinLon * northM;
      const dz = cosLat * northM;
      return fromEcef([x0 + dx, y0 + dy, z0 + dz]);
    },
  };
}

/** Horizontal distance in metres between two local points. */
export function localDistanceM(a: LocalPoint, b: LocalPoint): number {
  return Math.hypot(b.eastM - a.eastM, b.northM - a.northM);
}

/**
 * Horizontal distance in metres between two WGS84 coordinates, measured on a
 * tangent plane at the first one. Accurate to millimetres at street scale.
 */
export function distanceM(a: GeographicCoordinate, b: GeographicCoordinate): number {
  const p = createLocalFrame(a).toLocal(b);
  return Math.hypot(p.eastM, p.northM);
}
