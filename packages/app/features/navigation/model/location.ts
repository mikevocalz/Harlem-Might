import type { GeographicCoordinate, PositionAccuracy } from './geo.ts';

/** Where a {@linkcode LocationFix} came from. */
export type LocationSource =
  | 'device-gps'
  | 'companion-phone'
  /** A person picked the origin on a map (headsets have no GPS). Never filtered as if it moved. */
  | 'manual'
  /** ARCore Geospatial / VPS pose. Convert its 95% accuracy with `radius68From95`. */
  | 'ar-geospatial';

/**
 * One raw position report, exactly as the platform gave it. The pipeline
 * never edits a fix; filtered and route-matched positions are separate
 * values ({@linkcode FilteredPosition}, {@linkcode RouteMatch}).
 */
export interface LocationFix {
  readonly coordinate: GeographicCoordinate;
  readonly accuracy: PositionAccuracy;
  /** Milliseconds since the Unix epoch, from the platform fix (not from when JS received it). */
  readonly timestampMs: number;
  readonly source: LocationSource;
  /** Course over ground in degrees from true north when the platform reports one. */
  readonly courseDeg?: number;
  /** Ground speed in metres per second when the platform reports one. */
  readonly speedMps?: number;
}

/** Where a {@linkcode HeadingSample} came from. */
export type HeadingSource = 'compass' | 'ar-session' | 'course-over-ground';

/** One raw heading report. */
export interface HeadingSample {
  /** Degrees clockwise from true north. Any finite value; it is wrapped to 0..360. */
  readonly headingDeg: number;
  /** Platform-reported accuracy in degrees, when known. */
  readonly accuracyDeg?: number;
  readonly timestampMs: number;
  readonly source: HeadingSource;
}

/** Coarse trust level shared by heading and position estimates. */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * A smoothed heading. `confidence` falls when recent samples disagree
 * (circular spread) or the platform reports poor accuracy.
 */
export interface HeadingEstimate {
  /** Degrees clockwise from true north, 0 ≤ value < 360. */
  readonly headingDeg: number;
  readonly source: HeadingSource;
  readonly confidence: ConfidenceLevel;
  /** Mean resultant length of the recent window, 0..1. 1 means every sample agreed. */
  readonly consistency: number;
  readonly timestampMs: number;
}

/**
 * The Kalman-filtered position. Kept separate from the raw
 * {@linkcode LocationFix} that produced it and from the route-snapped
 * {@linkcode RouteMatch}.
 */
export interface FilteredPosition {
  readonly coordinate: GeographicCoordinate;
  /** One-sigma horizontal uncertainty of the filter state in metres. */
  readonly sigmaM: number;
  /** Filtered velocity, metres per second east and north. */
  readonly velocityEastMps: number;
  readonly velocityNorthMps: number;
  readonly speedMps: number;
  readonly timestampMs: number;
  readonly confidence: ConfidenceLevel;
}

/**
 * A filtered position snapped onto the active route, or the reason it could
 * not be.
 */
export type RouteMatch =
  | {
      readonly kind: 'matched';
      /** The snapped point on the route. */
      readonly coordinate: GeographicCoordinate;
      /** Index of the route geometry segment the point lies on. */
      readonly segmentIndex: number;
      /** Metres from the route start along the geometry. */
      readonly alongTrackM: number;
      /** Signed metres from the route: positive is left of the direction of travel. */
      readonly crossTrackM: number;
      /** Bearing of the matched segment, degrees from true north. */
      readonly segmentBearingDeg: number;
      /** Heading relative to the segment when a usable heading was available. */
      readonly travelDirection: 'forward' | 'backward' | 'unknown';
      readonly timestampMs: number;
    }
  | {
      readonly kind: 'unmatched';
      /** `too-far`: no segment within the candidate radius. `too-coarse`: the fix was too inaccurate to snap. */
      readonly reason: 'too-far' | 'too-coarse';
      /** Distance to the closest point of the route in metres. */
      readonly nearestDistanceM: number;
      readonly timestampMs: number;
    };
