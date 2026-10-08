import {
  MapboxNavigationClient,
  routeGeometryToCoordinates,
  type RouteGeometryCoordinate,
} from '@mapbox/react-native-mapbox-ar/navigation';

/** A place a walking route visits; `lngLat` is `[longitude, latitude]`. */
export interface RoutePlace {
  readonly id: string;
  readonly lngLat?: readonly [number, number];
}

/**
 * The route the tabletop draws. `walking` came from Mapbox Directions;
 * `straight` joins the places with straight lines and must be labelled as not
 * a walking route.
 */
export type WalkingRoute =
  | {
      readonly kind: 'walking';
      readonly routeId: string;
      readonly coordinates: readonly RouteGeometryCoordinate[];
      readonly distanceM: number;
      readonly durationS: number;
    }
  | {
      readonly kind: 'straight';
      readonly routeId: string;
      readonly coordinates: readonly RouteGeometryCoordinate[];
      readonly reason: 'no-token' | 'request-failed';
      /** Why the request failed, for the status line. */
      readonly error?: string;
    };

/**
 * Requests a walking route from `from` through `to`, in order, from Mapbox
 * Directions. Without a token, or when the request fails or finds no route,
 * it resolves with straight segments between the places instead (never
 * rejects for network reasons).
 *
 * The map layer calls this; the AR scene only draws the result (spec §6A).
 *
 * @throws {RangeError} When `to` is empty or a place has no coordinates.
 */
export async function fetchWalkingRoute(input: {
  readonly from: RoutePlace;
  readonly to: readonly RoutePlace[];
  readonly accessToken: string | undefined;
  readonly fetchImpl?: typeof fetch;
  readonly signal?: AbortSignal;
}): Promise<WalkingRoute> {
  if (input.to.length === 0) throw new RangeError('A walking route needs at least one destination');
  const places = [input.from, ...input.to];
  const coordinates = places.map(toCoordinate);
  const routeId = `walk:${input.from.id}:${input.to.map((place) => place.id).join(',')}`;

  if (!input.accessToken) {
    return { kind: 'straight', routeId, coordinates, reason: 'no-token' };
  }

  try {
    const client = new MapboxNavigationClient({
      accessToken: input.accessToken,
      fetchImpl: input.fetchImpl,
    });
    const response = await client.directions(coordinates, {
      profile: 'walking',
      alternatives: false,
      steps: false,
      signal: input.signal,
    });
    const route = response.routes[0];
    if (response.code !== 'Ok' || !route) {
      return {
        kind: 'straight',
        routeId,
        coordinates,
        reason: 'request-failed',
        error: `Directions returned ${response.code}`,
      };
    }
    return {
      kind: 'walking',
      routeId,
      coordinates: routeGeometryToCoordinates(route),
      distanceM: route.distance,
      durationS: route.duration,
    };
  } catch (error) {
    if (input.signal?.aborted) throw error;
    return {
      kind: 'straight',
      routeId,
      coordinates,
      reason: 'request-failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function toCoordinate(place: RoutePlace): RouteGeometryCoordinate {
  if (!place.lngLat) throw new RangeError(`Place ${place.id} has no coordinates`);
  return { latitude: place.lngLat[1], longitude: place.lngLat[0] };
}
