# Harlem Might — Specs experience

## Product and rendering rule

Harlem Might's phone, tablet, browser, Quest, PICO and Vision layouts retain
their existing renderers. Specs receives a **state projection**, not React
Native, ViroCore, Mapbox GL or a flattened WebView.

Pipeline:

```
Payload place catalogue + existing navigation Zustand stores
  -> packages/app/features/specs/experience.ts
  -> JSON: { scene, targets, navigation? }
  -> @viro-external/specs portable presentation validation
  -> Lens Studio ViroSpecsPresentationHost + SIK
  -> (when accurately localized) SpecsNavigationKit + VolumetricLine
```

The current source-only Lens bootstrap lives in `apps/specs`. It shows an
explicit offline preview until a connected app transport provides live state;
there is no production data transport in this first PR.

## Layout decisions

- Discover: a single focused card, up to four catalogue-backed places.
- Place: one title, one short summary and Directions/Back. No invented live
  opening hours, place images, phone location or arrival estimates.
- Walking: title, latest trustworthy turn instruction, one stop action. No
  large card or three-panel Quest workspace in the field of view.
- Arrival: confirmed and estimated arrivals use deliberately different text.
- Command binding: semantic action strings; the app/controller still owns
  authorization, route creation, session epoch and user preferences.

This app reuses the role semantics of `ADAPTIVE_EXPLORE_LAYOUT.md`. On glasses
the four roles are **progressively disclosed**, never four simultaneous panels.
Do not inherit the Quest default 2.6m workspace arc for walking.

## Route safety

A world-space route is only projected when ALL hold:

1. existing canonical session phase is `navigatingAR`;
2. current AR tracking reports `normal`;
3. positioning reports `tracking`, not low confidence or excessive speed;
4. progress belongs to the same route and is at most 20 seconds old;
5. actual route geometry has at least two finite WGS84 points;
6. navigation mode is walking.
7. entrance or destination coordinate is a valid finite WGS84 point.

The Specs Lens then still needs its own trusted location permission/position
before presenting the line. No endpoint is inferred from the current heading;
directions come from the canonical route provider and route generation.

## Next integration slices

1. Wire a bounded Mobile Kit transport between the existing Expo app and
   the Lens. Authenticate actions in the app; invalidate on sign-out,
   disconnect, expiry and permission changes. Avoid shipping CMS tokens in Lens.
2. Forward-port only audited pieces of the experimental
   `codex/specs-generated-preview` UI compiler (Rive/video/scroll are
   not on Viro External main).
3. Add saved places, walks, licensed historical media and stories through
   real catalogue readers, with rights/provenance preserved.
4. Run SPECS 27 CLAD Preview/LEAF and performance, then physical fit,
   sunlight readability, pose/GPS, thermals, battery and accessibility.
