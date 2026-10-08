import type { LocationFix } from '../model/location.ts';

/**
 * What the app may do with device location right now, as the directions
 * screen words it.
 *
 * - `unknown`: not asked yet. The screen explains why before the platform prompt.
 * - `granted`: precise fixes are arriving or will.
 * - `approximate`: fixes arrive but are too coarse to guide by (iOS reduced
 *   accuracy, desktop Wi-Fi positioning). Routes can still start near the person.
 * - `denied`: the person said no. Only a settings change undoes it.
 * - `disabled`: location services are off, or no position could be found.
 * - `unsupported`: this build or browser has no location source at all.
 */
export type LocationAvailability = 'unknown' | 'granted' | 'approximate' | 'denied' | 'disabled' | 'unsupported';

/** Callbacks a {@linkcode LocationSource} reports to. */
export interface LocationWatchHandlers {
  onFix(fix: LocationFix): void;
  onAvailability(availability: LocationAvailability): void;
}

/**
 * The device's position feed. One per platform; the navigation runtime owns
 * the single active watch. Foreground only: hosts stop the watch when the
 * app or tab is hidden, and nothing here records or uploads positions.
 */
export interface LocationSource {
  /** `browser` (W3C Geolocation) or `none` (no source in this build). */
  readonly kind: 'browser' | 'none';
  /** Reads the permission state without prompting. */
  check(): Promise<LocationAvailability>;
  /** Starts watching. The first call may show the platform prompt. Returns a stop function. */
  watch(handlers: LocationWatchHandlers): () => void;
}

/**
 * A 68% radius above this makes the feed `approximate`. Guidance rejects
 * fixes above the pipeline's 50 m gate anyway; 100 m leaves room for a
 * noisy-but-real GPS fix in a street canyon before telling the person their
 * location is approximate.
 */
export const APPROXIMATE_RADIUS_M = 100;

/** The subset of `GeolocationPosition` the adapter reads. */
export interface BrowserPosition {
  readonly coords: {
    readonly latitude: number;
    readonly longitude: number;
    readonly accuracy: number;
    readonly altitudeAccuracy?: number | null;
    readonly heading?: number | null;
    readonly speed?: number | null;
  };
  readonly timestamp: number;
}

/** The subset of `navigator.geolocation` the adapter calls. */
export interface BrowserGeolocation {
  watchPosition(
    success: (position: BrowserPosition) => void,
    error: (error: { readonly code: number }) => void,
    options: { enableHighAccuracy: boolean; maximumAge: number; timeout: number },
  ): number;
  clearWatch(id: number): void;
}

/** The subset of `navigator.permissions` the adapter calls. */
export interface BrowserPermissions {
  query(descriptor: { name: 'geolocation' }): Promise<{ readonly state: 'granted' | 'denied' | 'prompt' }>;
}

/**
 * Converts a W3C position to a {@linkcode LocationFix}. `accuracy` is passed
 * through as the 68% radius, the same treatment the domain gives iOS
 * `horizontalAccuracy` (docs/GEO_COORDINATE_SYSTEMS.md): browsers do not
 * agree on its confidence level, and Chrome on Android forwards Android's
 * 68% radius unchanged. Course and speed are kept only when the browser
 * reports real numbers (it sends null or NaN when stationary).
 */
export function fixFromBrowserPosition(position: BrowserPosition): LocationFix | undefined {
  const { latitude, longitude, accuracy, heading, speed, altitudeAccuracy } = position.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !(accuracy > 0) || !Number.isFinite(accuracy)) {
    return undefined;
  }
  const verticalM = typeof altitudeAccuracy === 'number' && altitudeAccuracy > 0 ? altitudeAccuracy : undefined;
  return {
    coordinate: { latitude, longitude },
    accuracy: { horizontalM: accuracy, ...(verticalM !== undefined ? { verticalM } : {}) },
    timestampMs: position.timestamp,
    source: 'device-gps',
    ...(typeof heading === 'number' && Number.isFinite(heading) ? { courseDeg: heading } : {}),
    ...(typeof speed === 'number' && Number.isFinite(speed) && speed >= 0 ? { speedMps: speed } : {}),
  };
}

/** Maps a `GeolocationPositionError.code` to an availability. 3 (timeout) is not terminal. */
export function availabilityFromBrowserError(code: number): LocationAvailability | undefined {
  if (code === 1) return 'denied';
  if (code === 2) return 'disabled';
  return undefined;
}

/** `approximate` when a fix is too coarse to guide by, else `granted`. */
export function availabilityFromFix(fix: LocationFix): LocationAvailability {
  return fix.accuracy.horizontalM > APPROXIMATE_RADIUS_M ? 'approximate' : 'granted';
}

/** A W3C Geolocation source. Pass the browser's objects; tests pass fakes. */
export function createBrowserLocationSource(
  geolocation: BrowserGeolocation | undefined,
  permissions?: BrowserPermissions,
): LocationSource {
  if (!geolocation) return NO_LOCATION_SOURCE;
  return {
    kind: 'browser',
    async check() {
      if (!permissions) return 'unknown';
      try {
        const { state } = await permissions.query({ name: 'geolocation' });
        return state === 'prompt' ? 'unknown' : state;
      } catch {
        // Safari before 16 has no geolocation permission query.
        return 'unknown';
      }
    },
    watch(handlers) {
      let last: LocationAvailability | undefined;
      const report = (availability: LocationAvailability) => {
        if (availability === last) return;
        last = availability;
        handlers.onAvailability(availability);
      };
      const id = geolocation.watchPosition(
        (position) => {
          const fix = fixFromBrowserPosition(position);
          if (!fix) return;
          report(availabilityFromFix(fix));
          handlers.onFix(fix);
        },
        (error) => {
          const availability = availabilityFromBrowserError(error.code);
          if (availability) report(availability);
        },
        // maximumAge 0: a cached fix from minutes ago would start the route in the wrong place.
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
      );
      return () => geolocation.clearWatch(id);
    },
  };
}

/** The source for a build with no location module. Always `unsupported`; never prompts. */
export const NO_LOCATION_SOURCE: LocationSource = {
  kind: 'none',
  check: async () => 'unsupported',
  watch(handlers) {
    handlers.onAvailability('unsupported');
    return () => {};
  },
};
