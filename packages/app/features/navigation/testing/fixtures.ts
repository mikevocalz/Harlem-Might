// Test-only helpers. Nothing outside *.test.ts files imports this module.
import { readdirSync, readFileSync } from 'node:fs';
import type { GeographicCoordinate } from '../model/geo.ts';
import type { Route, RouteDestination } from '../model/route.ts';
import { parseMapboxDirections } from '../providers/mapboxDirections.ts';

/**
 * A Mapbox Directions response recorded from the live API (token and
 * request uuid removed), with the request that produced it.
 */
export interface RouteFixture {
  readonly name: string;
  readonly source: string;
  readonly fetchedAt: string;
  readonly request: { readonly profile: string; readonly path: string; readonly query: Record<string, string> };
  readonly origin: { readonly placeId: string; readonly lngLat: readonly [number, number] };
  readonly destination: { readonly placeId: string; readonly lngLat: readonly [number, number] };
  readonly response: unknown;
}

const DIR = new URL('../__fixtures__/routes/', import.meta.url);

export const FIXTURE_NAMES: readonly string[] = readdirSync(DIR)
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.slice(0, -'.json'.length))
  .sort();

export function loadFixture(name: string): RouteFixture {
  const raw = JSON.parse(readFileSync(new URL(`${name}.json`, DIR), 'utf8')) as Omit<RouteFixture, 'name'>;
  return { name, ...raw };
}

/** Raw file text, for leak checks. */
export function fixtureText(name: string): string {
  return readFileSync(new URL(`${name}.json`, DIR), 'utf8');
}

export const lngLatToCoordinate = ([longitude, latitude]: readonly [number, number]): GeographicCoordinate => ({
  latitude,
  longitude,
});

let ids = 0;

/** The fixture's first route, parsed by the production adapter. */
export function fixtureRoute(name: string): Route {
  const response = parseMapboxDirections(loadFixture(name).response, 'walking', () => `${name}#${(ids += 1)}`);
  if (response.kind !== 'routes') throw new Error('fixture has no routes');
  return response.routes[0];
}

/** The fixture destination as a domain destination, with the provider's routable point as entrance. */
export function fixtureDestination(name: string, withEntrance = true): RouteDestination {
  const fixture = loadFixture(name);
  const route = fixtureRoute(name);
  const arrive = route.legs.at(-1)?.steps.at(-1)?.maneuver.location;
  return {
    name: fixture.destination.placeId,
    placeId: fixture.destination.placeId,
    coordinate: lngLatToCoordinate(fixture.destination.lngLat),
    ...(withEntrance && arrive ? { entrance: { coordinate: arrive, source: 'provider-routable-point' as const } } : {}),
  };
}
