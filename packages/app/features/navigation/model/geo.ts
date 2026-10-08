/**
 * A WGS84 position. Latitude and longitude are in degrees; this is the order
 * the domain uses everywhere. Provider adapters convert from GeoJSON's
 * `[lng, lat]` at the boundary and nowhere else.
 *
 * Used by `RouteGeometry`, `LocationFix.coordinate` and every place and
 * entrance position.
 */
export interface GeographicCoordinate {
  /** Degrees, -90..90. */
  readonly latitude: number;
  /** Degrees, -180..180. */
  readonly longitude: number;
}

/**
 * How far a position may be from the truth.
 *
 * `horizontalM` is the platform's reported radius. Android documents
 * `Location.getAccuracy()` as the radius of 68% confidence; iOS documents
 * `horizontalAccuracy` only as "the radius of uncertainty", and the pipeline
 * treats it the same way. The location pipeline converts the radius to a
 * per-axis standard deviation; see `docs/GEO_COORDINATE_SYSTEMS.md`.
 *
 * Carried on `LocationFix.accuracy`.
 */
export interface PositionAccuracy {
  /** 68% horizontal radius in metres. Always finite and positive. */
  readonly horizontalM: number;
  /** Vertical accuracy in metres when the platform reports one. */
  readonly verticalM?: number;
}

/** Throws a RangeError naming the field when a coordinate is not a valid WGS84 position. */
export function assertCoordinate(value: GeographicCoordinate, label = 'coordinate'): void {
  if (!Number.isFinite(value.latitude) || value.latitude < -90 || value.latitude > 90) {
    throw new RangeError(`${label}.latitude must be a finite number between -90 and 90`);
  }
  if (!Number.isFinite(value.longitude) || value.longitude < -180 || value.longitude > 180) {
    throw new RangeError(`${label}.longitude must be a finite number between -180 and 180`);
  }
}

/** σ = r / k for a circular 2D Gaussian, where P(r ≤ kσ) = 1 − e^(−k²/2). */
const K68 = Math.sqrt(-2 * Math.log(1 - 0.68));
const K95 = Math.sqrt(-2 * Math.log(1 - 0.95));

/**
 * Converts a 95%-confidence horizontal radius to the 68% radius
 * `PositionAccuracy.horizontalM` expects. ARCore Geospatial (and Viro's
 * `ViroGeospatialPose.horizontalAccuracy`) report 95% radii; feeding them in
 * unconverted would make those fixes look 1.6× worse than they are.
 */
export function radius68From95(radius95M: number): number {
  if (!(radius95M > 0) || !Number.isFinite(radius95M)) throw new RangeError('radius95M must be a positive finite number');
  return (radius95M / K95) * K68;
}
