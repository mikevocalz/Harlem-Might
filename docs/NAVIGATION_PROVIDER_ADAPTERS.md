# Navigation provider adapters

Routing backends sit behind one interface, `RouteProvider`
(`packages/app/features/navigation/providers/routeProvider.ts`):

```ts
interface RouteProvider {
  readonly id: 'mapbox' | 'google';
  readonly supportedModes: readonly TravelMode[];
  getRoutes(request: RouteRequest, options?: { signal?: AbortSignal }): Promise<RouteResponse>;
}
```

Every adapter follows these rules:

- **At least one route:** resolve `{ kind: 'routes', routes: [best, ...alternatives] }`.
  The tuple type means there is never an empty list.
- **Mode it cannot route:** resolve `{ kind: 'unsupported', handoff }`, where
  `handoff` holds Apple Maps and Google Maps URLs. Never draw a made-up line.
- **Any failure:** reject with `RouteProviderError`, whose `kind` is one of
  `no-route`, `unauthorized`, `rate-limited`, `unavailable`, `network`,
  `invalid-request`, `missing-token` or `aborted`. Messages never contain the
  access token.
- **Cancellation:** pass the `AbortSignal` through to `fetch`. An aborted
  request rejects with `kind: 'aborted'`, which callers ignore.
- **Destination:** route to `destination.entrance` when it exists, otherwise
  to `destination.coordinate`.

## Mapbox Directions (`mapboxDirections.ts`)

| Mode | Profile |
|---|---|
| walking | `mapbox/walking` |
| cycling | `mapbox/cycling` |
| driving | `mapbox/driving-traffic` |
| transit | none: `unsupported` with handoff, no network call |

The adapter always sets the profile itself. nitro-mapbox-ar's
`MapboxNavigationClient` defaults to `driving-traffic`, which would send
walkers along avenues meant for cars.

Query: `alternatives=true`, `geometries=geojson`, `overview=full`,
`steps=true`, `language=en`. A reroute adds `bearings=<heading>,<tolerance>;`
for the origin so the new route starts in the direction the person is already
walking. The default tolerance is 45°.

### Status mapping

| Response | `kind` |
|---|---|
| `code: NoRoute` or `NoSegment` (any status) | `no-route` |
| `code: InvalidInput` or `ProfileNotFound`; HTTP 400/422 | `invalid-request` |
| HTTP 401/403, `InvalidToken` | `unauthorized` |
| HTTP 429 | `rate-limited` |
| other 5xx, unreadable body, malformed shape | `unavailable` |
| `fetch` throws | `network` |
| `AbortError` | `aborted` |

### Parsing

`parseMapboxDirections` converts `[lng, lat]` positions to
`{ latitude, longitude }`, maps Mapbox's space-separated maneuver types to
kebab-case (`end of road` → `end-of-road`, `sharp right` → `sharp-right`),
and numbers steps across all legs. Unknown types become `other`. A geometry
that is not a GeoJSON `LineString` (for example an encoded polyline) is
rejected, because the request always asks for `geometries=geojson`.

### Token

`mapboxTokenFromEnv()` reads `EXPO_PUBLIC_MAPBOX_TOKEN` (native) and then
`NEXT_PUBLIC_MAPBOX_TOKEN` (web). Both bundlers inline those only when
written as a literal `process.env.NAME`, which is why that read happens in one
place. Only public `pk.` tokens are accepted; a secret `sk.` token is refused
before any request.

## Recorded fixtures

`packages/app/features/navigation/__fixtures__/routes/` holds real responses
from the Mapbox Directions API v5 `mapbox/walking` profile, fetched on
2026-10-08. The access token was never written to disk, and the request
`uuid` was removed.

| Fixture | Distance | Steps |
|---|---|---|
| Apollo Theater → Sylvia's | 567 m | 6 |
| Red Rooster → Schomburg Center | 842 m | 20 |
| Studio Museum → Marcus Garvey Park | 807 m | 11 |
| Apollo Theater → Marcus Garvey Park (multi-turn avenue crossing) | 1,217 m | 8 |
| Schomburg Center → Studio Museum | 1,040 m | 25 |
| Studio Museum → via Sylvia's → mid-block West 126th St (two legs) | 642 m | 13 |

The last one has a via point so the route is U-shaped: east on West 125th,
north on Malcolm X Boulevard, then back down it and west on West 126th. That
gives real parallel streets and a stretch of pavement walked twice in opposite
directions, for the matcher's continuity tests. None of the plain
origin-to-destination routes double back.

Each fixture stores the request path and query. `providers.test.ts` checks that
the adapter rebuilds exactly that request for every two-point fixture, so the
recordings and the code cannot drift apart unnoticed.

To re-record, fetch the same paths with the public token from `.env`, read
in-process, delete `uuid`, and grep the result for `pk.` and `access_token`
before committing. CI runs that grep through the fixture test.

## GPS traces

No GPS recordings exist yet. `testing/traces.ts` samples the recorded route
geometries at walking speed and adds seeded noise (mulberry32 + Box-Muller),
so every run is identical. It can also add dropouts, constant drift
(multipath), single jumps, reversals and departures from the route. Every true
position lies on a Mapbox polyline; only the measurement error is synthetic.
Real recorded walks should replace these before the thresholds are called
final.

## Google Routes (not built)

An optional adapter behind the same interface. It would map `WALK`,
`BICYCLE` and `DRIVE`, and treat `TRANSIT` as either a real transit route or
`unsupported`, decided by product. It is not needed for Phase 1.
