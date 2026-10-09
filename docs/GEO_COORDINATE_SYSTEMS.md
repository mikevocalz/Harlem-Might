# Geo coordinate systems

Every position in navigation goes through the same chain of frames. This page
fixes each frame's axes, units and signs so the map, the AR view and the tests
agree.

```
WGS84 (lat, lng degrees)
  → ECEF (metres, Earth-centred)
  → local ENU (east, north, up metres at a fixed origin)
  → device frame (camera-relative, Phase 3)
  → Viro world (x = east, y = up, z = −north)
  → AR anchor
```

## WGS84

`GeographicCoordinate { latitude, longitude }` in degrees. The domain always
uses this order. GeoJSON (and Mapbox) uses `[lng, lat]`; the provider adapter
converts at the boundary (`providers/mapboxDirections.ts`) and nowhere else.

## Local ENU (`geo/localFrame.ts`)

`createLocalFrame(origin)` returns a tangent plane at a fixed WGS84 origin:

| Axis | Positive direction | Unit |
|---|---|---|
| `eastM` | true east | metres |
| `northM` | true north | metres |

Up is dropped: street navigation is horizontal, and at Harlem scale (under
3 km) the east/north error from ignoring altitude is under a millimetre.

The math is WGS84 → ECEF → ENU on the WGS84 ellipsoid (a = 6378137 m,
f = 1/298.257223563). It is the same derivation as `projectToEnu` in
`@mapbox/react-native-mapbox-ar-reactvision`, and `geo/geo.test.ts` pins it to
values that function produced, to 1 mm, at points up to 2.8 km from the
Apollo Theater. The inverse (`toGeographic`) round-trips to under 1 mm.

Which origin each part of navigation uses:

- **Location pipeline:** the first accepted fix. A manual origin or a filter
  reset re-anchors it.
- **Route matcher and progress:** the first coordinate of the route. A reroute
  creates a new matcher, so a new origin.
- **Arrival:** a tangent plane at the filtered position (`distanceM`).

### Never Web Mercator

Mercator metres are stretched by 1/cos(latitude): 1.32× at 40.81° N. A café
100 m away would be drawn 132 m away. Viro's `gpsToArWorld` uses Mercator
deltas as metres, so nothing in navigation calls it. The test "is not Web
Mercator" checks that 0.01° of longitude at Apollo is 843.6 m.

### Never project in degrees

A degree of longitude at Harlem is 0.757 of a degree of latitude. Projecting a
point onto a diagonal segment in raw degrees biases where the foot point lands
along it. `geo/polyline.ts` projects only in ENU metres; the test "projects a
diagonal Harlem segment correctly…" shows the degree-space answer is off.

## Signs and angles

- **Bearing / heading:** degrees clockwise from true north, 0 ≤ θ < 360
  (`normalizeDegrees`). `signedDeltaDegrees(a, b)` is in (−180, 180];
  positive is clockwise, which is a right turn.
- **Cross-track distance:** positive when the point is left of the route's
  direction of travel (cross product of segment × point > 0 in east/north).
- **Along-track distance:** metres from the route's first position along the
  projected geometry. Progress scales it to the provider's route distance,
  because geometry and provider lengths differ by a few metres of rounding.

## Accuracy

`PositionAccuracy.horizontalM` is a 68% radius:

- **Android:** `Location.getAccuracy()` is documented as the 68% radius.
- **iOS:** `horizontalAccuracy` is documented as "the radius of uncertainty"
  with no confidence level. It is treated as 68%.
- **ARCore Geospatial / Viro geospatial pose:** reports 95% radii. Convert
  them with `radius68From95` before building a `LocationFix`.

For a circular 2D Gaussian, P(r ≤ kσ) = 1 − e^(−k²/2), so σ = r68 / 1.51 =
r95 / 2.45. The Kalman filter uses σ per axis (`config.location.radiusToSigma`).

## Device frame, Viro and anchors (Phase 3)

These frames belong to the AR phase and already exist in nitro-mapbox-ar:

- **Viro world:** `enuToViroPosition`, x = east, y = up, z = −north. Viro yaw
  is counter-clockwise from above, the opposite sense to a compass bearing,
  so a chevron facing bearing θ needs Viro yaw −(θ − worldYawOffset).
- **Device frame:** `projectToDeviceFrame`, camera-relative and rotated by the
  pose heading.
- **Route placement:** `projectRouteToEnu` + `solveEnuPlacement`, with only
  the parent node moving when placement changes.

The navigation domain hands the AR layer the active route geometry, the
matched along-track distance and the heading estimate. It never hands over a
straight line to the destination.
