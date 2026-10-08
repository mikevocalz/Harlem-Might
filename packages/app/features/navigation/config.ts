import type { HeadingSmootherConfig } from './location/heading.ts';
import type { TravelMode } from './model/route.ts';

/**
 * Every threshold the navigation pipeline uses. All are overridable through
 * {@linkcode resolveNavigationConfig}. The defaults follow the reference-repo
 * study and the Mapbox Navigation SDK for iOS v2.20.0 constants noted on each
 * field. They are tested against traces synthesised from the recorded Harlem
 * routes in `__fixtures__/`, and need re-tuning against real recorded walks.
 */
export interface NavigationConfig {
  readonly location: {
    /**
     * Fixes with a 68% radius above this are rejected for navigation. The
     * ARQuest reference app flags "weak GPS" at 65 m; AR guidance needs tighter.
     */
    readonly maxAccuracyM: number;
    /** Fixes older than this (relative to `now`) are stale. */
    readonly maxFixAgeMs: number;
    /** Fixes stamped further than this into the future are rejected (clock skew). */
    readonly maxFutureSkewMs: number;
    /**
     * Converts a 68% radius to a per-axis sigma. For a circular bivariate
     * normal the 68% radius is σ·√(−2 ln 0.32) ≈ 1.51σ.
     */
    readonly radiusToSigma: number;
    /** Kalman white-noise acceleration density, m²/s³. */
    readonly accelerationDensity: number;
    /** Prior speed uncertainty when the filter starts, m/s. */
    readonly initialSpeedSigmaMps: number;
    /**
     * Mahalanobis gate. 13.82 is the 99.9th percentile of chi-square with 2
     * degrees of freedom, so a correct model rejects 1 in 1000 good fixes.
     */
    readonly outlierGateChiSq: number;
    /** After this many outliers in a row the filter re-initialises at the latest fix (the person really moved). */
    readonly outliersBeforeReset: number;
    /** Implied speeds above this, after subtracting both accuracies, are rejected as jumps. Per mode. */
    readonly maxPlausibleSpeedMps: Readonly<Record<TravelMode, number>>;
    /** Filtered 68% radius at or below which confidence is `high`. */
    readonly highConfidenceRadiusM: number;
    /** Filtered 68% radius at or below which confidence is `medium`. */
    readonly mediumConfidenceRadiusM: number;
    /** Above this filtered speed for `tooFastDurationMs`, positioning reports `isMovingTooFast`. 6.7 m/s is 24 km/h. */
    readonly tooFastSpeedMps: number;
    readonly tooFastDurationMs: number;
    /** No accepted fix for this long turns positioning to `lost`. */
    readonly lostAfterMs: number;
  };
  readonly heading: HeadingSmootherConfig & {
    /**
     * Below this speed the course over ground is too noisy to use as a
     * heading. Mapbox iOS: `RouteControllerMaximumSpeedForUsingCurrentStep = 1`.
     */
    readonly minCourseSpeedMps: number;
  };
  readonly matching: {
    /**
     * Fixes with a 68% radius above this are not snapped to the route (the
     * match is `unmatched` with reason `too-coarse`). Mapbox Navigation SDK
     * for iOS v2.20.0 uses 20 m (`RouteSnappingMinimumHorizontalAccuracy`).
     */
    readonly maxSnapAccuracyM: number;
    /** Segments further than max(this, 3σ) are not candidates. */
    readonly minCandidateRadiusM: number;
    /** Cost weight for heading disagreement; 0 disables heading in matching. */
    readonly headingWeight: number;
    /** Backward movement along the route allowed without penalty, metres. */
    readonly backtrackToleranceM: number;
    /** Forward movement allowed beyond speed × Δt without penalty, metres. */
    readonly forwardSlackM: number;
    /** Cost weight for along-track jumps beyond the tolerances. */
    readonly continuityWeight: number;
    /** Heading-vs-segment angle above which travel counts as backward, degrees. */
    readonly backwardAngleDeg: number;
  };
  readonly deviation: {
    /**
     * Minimum off-route distance in metres. Mapbox Navigation SDK for iOS
     * v2.20.0 snaps within 15 m plus accuracy
     * (`RouteControllerUserLocationSnappingDistance`). The around-bulsu
     * reference app reroutes at 12 m on a single fix and churns on urban
     * multipath; we require 20 m and several fixes.
     */
    readonly minDistanceM: number;
    /** The threshold grows to `accuracyMultiplier` × the fix's 68% radius when that is larger. */
    readonly accuracyMultiplier: number;
    /** Reliable fixes beyond the threshold needed to declare off-route. */
    readonly consecutiveFixes: number;
    /** And at least this long since the first of them. */
    readonly minDurationMs: number;
    /** Fixes with a 68% radius above this neither count toward nor clear a deviation. */
    readonly reliableAccuracyM: number;
    /** Backward fixes in a row before `wrong-direction`. Mapbox iOS: `RouteControllerMinNumberOfInCorrectCourses = 4`. */
    readonly wrongDirectionFixes: number;
    /** Wrong direction is judged only above this speed. */
    readonly wrongDirectionMinSpeedMps: number;
  };
  readonly reroute: {
    /** Waits this long after the trigger before requesting, so a burst coalesces. */
    readonly debounceMs: number;
    /** Minimum time between two reroute requests. around-bulsu uses 3 s. */
    readonly minIntervalMs: number;
    /** Bearing tolerance sent with the origin heading, degrees. */
    readonly bearingToleranceDeg: number;
  };
  readonly arrival: {
    /**
     * Radius around the entrance that counts as arrived. ARQuest enters at
     * 25 m and leaves at 45 m; an entrance point lets us be tighter.
     */
    readonly arriveRadiusM: number;
    /** The radius grows by the fix's 68% radius, capped here (BooksOnWall's radius + min(accuracy, cap)). */
    readonly accuracyAllowanceCapM: number;
    /** Distance at which the state becomes `approaching`. */
    readonly approachRadiusM: number;
    /** Leaving `arrived` needs this distance (hysteresis). */
    readonly exitRadiusM: number;
    /** Fixes inside the radius in a row before `arrived`. */
    readonly dwellFixes: number;
    /** Fixes outside `exitRadiusM` in a row before leaving `arrived`. */
    readonly exitFixes: number;
    /** A 68% radius at or below this makes arrival `confirmed`; above it, `estimated`. */
    readonly confirmAccuracyM: number;
  };
}

/** The defaults. Values and their sources are documented on {@linkcode NavigationConfig}. */
export const DEFAULT_NAVIGATION_CONFIG: NavigationConfig = {
  location: {
    maxAccuracyM: 50,
    maxFixAgeMs: 10_000,
    maxFutureSkewMs: 5_000,
    radiusToSigma: 1 / 1.51,
    accelerationDensity: 1,
    initialSpeedSigmaMps: 2,
    outlierGateChiSq: 13.82,
    outliersBeforeReset: 3,
    maxPlausibleSpeedMps: { walking: 7, cycling: 18, driving: 50, transit: 50 },
    highConfidenceRadiusM: 10,
    mediumConfidenceRadiusM: 25,
    tooFastSpeedMps: 6.7,
    tooFastDurationMs: 5_000,
    lostAfterMs: 15_000,
  },
  heading: {
    timeConstantS: 0.6,
    windowSize: 10,
    highConsistency: 0.85,
    mediumConsistency: 0.6,
    maxHighAccuracyDeg: 20,
    maxUsableAccuracyDeg: 60,
    minCourseSpeedMps: 1,
  },
  matching: {
    maxSnapAccuracyM: 20,
    minCandidateRadiusM: 30,
    headingWeight: 4,
    backtrackToleranceM: 10,
    forwardSlackM: 15,
    continuityWeight: 1,
    backwardAngleDeg: 120,
  },
  deviation: {
    minDistanceM: 20,
    accuracyMultiplier: 1,
    consecutiveFixes: 3,
    minDurationMs: 3_000,
    reliableAccuracyM: 30,
    wrongDirectionFixes: 4,
    wrongDirectionMinSpeedMps: 1,
  },
  reroute: {
    debounceMs: 1_000,
    minIntervalMs: 8_000,
    bearingToleranceDeg: 45,
  },
  arrival: {
    arriveRadiusM: 12,
    accuracyAllowanceCapM: 8,
    approachRadiusM: 60,
    exitRadiusM: 35,
    dwellFixes: 2,
    exitFixes: 3,
    confirmAccuracyM: 10,
  },
};

/** Partial overrides, one level deep per section. */
export type NavigationConfigOverrides = {
  readonly [Section in keyof NavigationConfig]?: Partial<NavigationConfig[Section]>;
};

/** Merges overrides onto {@linkcode DEFAULT_NAVIGATION_CONFIG}. */
export function resolveNavigationConfig(overrides: NavigationConfigOverrides = {}): NavigationConfig {
  const d = DEFAULT_NAVIGATION_CONFIG;
  return {
    location: { ...d.location, ...overrides.location },
    heading: { ...d.heading, ...overrides.heading },
    matching: { ...d.matching, ...overrides.matching },
    deviation: { ...d.deviation, ...overrides.deviation },
    reroute: { ...d.reroute, ...overrides.reroute },
    arrival: { ...d.arrival, ...overrides.arrival },
  };
}
