import { assertCoordinate, type GeographicCoordinate } from '../model/geo.ts';
import {
  arrivalTarget,
  type ManeuverModifier,
  type ManeuverType,
  type Route,
  type RouteGeometry,
  type RouteLeg,
  type RouteRequest,
  type RouteResponse,
  type RouteStep,
  type TravelMode,
} from '../model/route.ts';
import { buildExternalMapsHandoff } from './externalMaps.ts';
import { RouteProviderError, type RouteProvider, type RouteProviderErrorKind } from './routeProvider.ts';

/** Options for {@linkcode createMapboxDirectionsProvider}. */
export interface MapboxDirectionsOptions {
  /** A public `pk.` token. Read it with `mapboxTokenFromEnv()`; never hard-code one. */
  readonly accessToken: string;
  /** Injected for tests. @default globalThis.fetch */
  readonly fetchImpl?: typeof fetch;
  /** Produces route ids. @default a per-process counter */
  readonly createRouteId?: () => string;
}


/** Mapbox Directions profile for each routable mode. */
export const MAPBOX_PROFILE: Readonly<Record<Exclude<TravelMode, 'transit'>, string>> = {
  walking: 'walking',
  cycling: 'cycling',
  driving: 'driving-traffic',
};

let routeSequence = 0;
const defaultRouteId = () => `mapbox-route-${(routeSequence += 1)}`;

/**
 * The query string the adapter sends, minus the token. Exported so the
 * recorded fixtures can be checked against the live request shape.
 */
export function buildMapboxDirectionsQuery(request: RouteRequest): URLSearchParams {
  const params = new URLSearchParams({
    alternatives: String(request.includeAlternatives ?? true),
    geometries: 'geojson',
    overview: 'full',
    steps: 'true',
    language: request.language ?? 'en',
  });
  if (request.originBearing) {
    const heading = Math.round(((request.originBearing.headingDeg % 360) + 360) % 360);
    const tolerance = Math.round(Math.min(180, Math.max(0, request.originBearing.toleranceDeg)));
    params.set('bearings', `${heading},${tolerance};`);
  }
  return params;
}

/** The URL path (profile and coordinates) the adapter requests. */
export function buildMapboxDirectionsPath(request: RouteRequest): string {
  if (request.mode === 'transit') throw new RangeError('Mapbox Directions has no transit profile');
  const destination = arrivalTarget(request.destination);
  assertCoordinate(request.origin, 'origin');
  assertCoordinate(destination, 'destination');
  const lngLat = (c: GeographicCoordinate) => `${c.longitude},${c.latitude}`;
  return `/directions/v5/mapbox/${MAPBOX_PROFILE[request.mode]}/${lngLat(request.origin)};${lngLat(destination)}`;
}

/**
 * A {@linkcode RouteProvider} over the Mapbox Directions API v5.
 *
 * Requests `overview=full`, `geometries=geojson`, `steps=true` and
 * alternatives. Routes go to the destination's entrance when one is known.
 * Transit resolves as `unsupported` with Apple/Google Maps links.
 *
 * @throws {RangeError} When the token is missing or not a public `pk.` token.
 */
export function createMapboxDirectionsProvider(options: MapboxDirectionsOptions): RouteProvider {
  const token = options.accessToken.trim();
  if (!token.startsWith('pk.')) {
    throw new RangeError('Mapbox Directions needs a public pk. access token');
  }
  const doFetch = options.fetchImpl ?? globalThis.fetch;
  const createRouteId = options.createRouteId ?? defaultRouteId;

  return {
    id: 'mapbox',
    supportedModes: ['walking', 'cycling', 'driving'],
    async getRoutes(request, { signal } = {}) {
      if (request.mode === 'transit') {
        return {
          kind: 'unsupported',
          mode: 'transit',
          reason: 'Mapbox Directions does not route public transit.',
          handoff: buildExternalMapsHandoff(request),
        };
      }
      if (signal?.aborted) throw new RouteProviderError('aborted', 'mapbox', 'Route request was cancelled');
      const query = buildMapboxDirectionsQuery(request);
      query.set('access_token', token);
      const url = `https://api.mapbox.com${buildMapboxDirectionsPath(request)}?${query}`;

      let response: Response;
      try {
        response = await doFetch(url, signal ? { signal } : undefined);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new RouteProviderError('aborted', 'mapbox', 'Route request was cancelled');
        }
        throw new RouteProviderError('network', 'mapbox', 'Mapbox Directions could not be reached');
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new RouteProviderError('aborted', 'mapbox', 'Route request was cancelled');
        }
        throw new RouteProviderError(
          response.ok ? 'unavailable' : kindForStatus(response.status, undefined),
          'mapbox',
          `Mapbox Directions returned an unreadable body (HTTP ${response.status})`,
          response.status,
        );
      }
      const code = isRecord(body) && typeof body.code === 'string' ? body.code : undefined;
      if (!response.ok || code !== 'Ok') {
        const message = isRecord(body) && typeof body.message === 'string' ? body.message : 'no message';
        throw new RouteProviderError(
          kindForStatus(response.status, code),
          'mapbox',
          `Mapbox Directions failed: HTTP ${response.status}, ${code ?? 'no code'}: ${message}`,
          response.status,
        );
      }
      return parseMapboxDirections(body, request.mode, createRouteId);
    },
  };
}

function kindForStatus(status: number, code: string | undefined): RouteProviderErrorKind {
  if (code === 'NoRoute' || code === 'NoSegment') return 'no-route';
  if (code === 'InvalidInput' || code === 'ProfileNotFound') return 'invalid-request';
  if (status === 401 || status === 403 || code === 'InvalidToken') return 'unauthorized';
  if (status === 429) return 'rate-limited';
  if (status === 422 || status === 400) return 'invalid-request';
  return 'unavailable';
}

/**
 * Converts a Mapbox Directions `Ok` body into a {@linkcode RouteResponse}.
 *
 * @throws {RouteProviderError} `no-route` when the body has no routes, and
 * `unavailable` when it does not have the documented shape.
 */
export function parseMapboxDirections(
  body: unknown,
  mode: Exclude<TravelMode, 'transit'>,
  createRouteId: () => string = defaultRouteId,
): RouteResponse {
  if (!isRecord(body) || !Array.isArray(body.routes)) malformed('routes');
  const routes = (body.routes as unknown[]).map((raw) => parseRoute(raw, mode, createRouteId()));
  const [first, ...rest] = routes;
  if (!first) throw new RouteProviderError('no-route', 'mapbox', 'Mapbox Directions returned no routes');
  return { kind: 'routes', provider: 'mapbox', routes: [first, ...rest] };
}

function parseRoute(raw: unknown, mode: Exclude<TravelMode, 'transit'>, id: string): Route {
  if (!isRecord(raw)) malformed('route');
  const legs = Array.isArray(raw.legs) ? raw.legs : malformed('route.legs');
  let stepIndex = 0;
  const parsedLegs: RouteLeg[] = legs.map((leg: unknown) => {
    if (!isRecord(leg) || !Array.isArray(leg.steps)) malformed('leg.steps');
    return {
      distanceM: num(leg.distance, 'leg.distance'),
      durationS: num(leg.duration, 'leg.duration'),
      steps: (leg.steps as unknown[]).map((step) => parseStep(step, stepIndex++)),
    };
  });
  return {
    id,
    provider: 'mapbox',
    mode,
    geometry: parseGeometry(raw.geometry, 'route.geometry'),
    distanceM: num(raw.distance, 'route.distance'),
    durationS: num(raw.duration, 'route.duration'),
    legs: parsedLegs,
  };
}

function parseStep(raw: unknown, index: number): RouteStep {
  if (!isRecord(raw) || !isRecord(raw.maneuver)) malformed('step.maneuver');
  const m = raw.maneuver as Record<string, unknown>;
  const modifier = parseModifier(m.modifier);
  return {
    index,
    name: typeof raw.name === 'string' ? raw.name : '',
    distanceM: num(raw.distance, 'step.distance'),
    durationS: num(raw.duration, 'step.duration'),
    geometry: parseGeometry(raw.geometry, 'step.geometry'),
    maneuver: {
      type: parseManeuverType(m.type),
      ...(modifier ? { modifier } : {}),
      location: lngLatToCoordinate(m.location, 'maneuver.location'),
      bearingBeforeDeg: num(m.bearing_before, 'maneuver.bearing_before'),
      bearingAfterDeg: num(m.bearing_after, 'maneuver.bearing_after'),
      instruction: typeof m.instruction === 'string' ? m.instruction : '',
    },
  };
}

const MANEUVER_TYPES: Readonly<Record<string, ManeuverType>> = {
  depart: 'depart',
  arrive: 'arrive',
  turn: 'turn',
  continue: 'continue',
  'new name': 'new-name',
  'end of road': 'end-of-road',
  fork: 'fork',
  merge: 'merge',
  'on ramp': 'on-ramp',
  'off ramp': 'off-ramp',
  roundabout: 'roundabout',
  rotary: 'rotary',
  'roundabout turn': 'roundabout-turn',
  'exit roundabout': 'exit-roundabout',
  'exit rotary': 'exit-rotary',
  notification: 'notification',
};

function parseManeuverType(value: unknown): ManeuverType {
  return (typeof value === 'string' && MANEUVER_TYPES[value]) || 'other';
}

const MODIFIERS: Readonly<Record<string, ManeuverModifier>> = {
  uturn: 'uturn',
  'sharp right': 'sharp-right',
  right: 'right',
  'slight right': 'slight-right',
  straight: 'straight',
  'slight left': 'slight-left',
  left: 'left',
  'sharp left': 'sharp-left',
};

function parseModifier(value: unknown): ManeuverModifier | undefined {
  return typeof value === 'string' ? MODIFIERS[value] : undefined;
}

function parseGeometry(raw: unknown, label: string): RouteGeometry {
  if (!isRecord(raw) || raw.type !== 'LineString' || !Array.isArray(raw.coordinates)) {
    malformed(`${label} (expected a GeoJSON LineString; request geometries=geojson)`);
  }
  return {
    kind: 'line-string',
    coordinates: (raw.coordinates as unknown[]).map((position) => lngLatToCoordinate(position, label)),
  };
}

function lngLatToCoordinate(raw: unknown, label: string): GeographicCoordinate {
  if (!Array.isArray(raw) || raw.length < 2) malformed(label);
  const coordinate = { longitude: num(raw[0], label), latitude: num(raw[1], label) };
  try {
    assertCoordinate(coordinate, label);
  } catch {
    malformed(label);
  }
  return coordinate;
}

function num(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) malformed(label);
  return value as number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function malformed(label: string): never {
  throw new RouteProviderError('unavailable', 'mapbox', `Mapbox Directions response is malformed at ${label}`);
}
