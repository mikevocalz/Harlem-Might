# ADR 0003: Explore map style and markers

**Status:** Accepted for markers. Interim realism uses Mapbox Standard in GL and classic satellite statics; the token-built style is still not live (waits on one account-owner upload).
**Date:** 2026-10-07
**Deciders:** Mike Allen (repo owner)

## Context

Explore historically drew the GL map with `mapbox://styles/mapbox/dark-v11` (`apps/web/components/explore/ExploreMap.tsx`). Static rasters were equally flat because they used the same style through `packages/ui/mights/MightsMapImage.tsx:STYLE`. Standing decision D2 asks Phase 4 to compare dark-v11 with a warm-dark style built from our tokens, with no light prototype (audit §16, architecture ADR-03 and ADR-04).

dark-v11 is fully desaturated (`hsl(0, 0%, …)` on all 50 layers). It shows Mapbox POI labels next to our pins, so "Apollo Th…" sits under the selected Apollo marker (`explore@1440-apollo.png` in the Phase 4 captures).

Two Mapbox facts decide most of this:

- The Static Images API takes a style as `{username}/{style_id}` only. It rejects inline style JSON and does not render Mapbox Standard (a live request returned HTTP 400, `Unsupported rasterarray tileset format`).
- `mapboxgl.Marker` sets `role="img"` on any element that has no `role` (`node_modules/mapbox-gl/dist/mapbox-gl-dev.js`, Marker constructor, `if (!this._element.hasAttribute("role"))`, mapbox-gl 3.32.0). That made our marker buttons announce as images, and axe flagged `aria-pressed` as invalid on all six.

## Decision

### Style

1. `tooling/map-style/build-map-style.mjs` builds `tooling/map-style/mights-dark.json` from a dark-v11 snapshot (`tooling/map-style/source/dark-v11.json`, fetched 2026-10-07) plus `packages/theme/tokens.ts`. It keeps dark-v11's sources, sprite and glyphs, so tiles, fonts and attribution stay the same, and changes only paint and visibility:
   - ground `semantic.surface.dark`, landuse `semantic.paper.dark`, buildings `surface-raised` with a `border` edge, water `palette.mights.night`;
   - parks: `semantic.verdigris.dark` at 10% over the ground, the only hue on the map besides our gold;
   - `road-simple`, `bridge-simple` and `tunnel-simple` get a `match` on `class`. dark-v11 varies only `line-width` by class there, so without the match avenues and side streets share one colour. Motorway through tertiary get a quarter-step from `border` toward `border-strong`; every other class gets `border`;
   - labels get `text-muted` on a `surface` halo, 1.5 px wide;
   - `poi-label`, `airport-label` and `natural-point-label` are hidden, so gold pins are the only saturated marks.
2. Until the account style exists, Explore GL uses `mapbox://styles/mapbox/standard` with the `faded` theme, `day` light preset and maintained `show3dObjects` pass. Static rasters use `mapbox/satellite-streets-v12`, because the Static Images API rejects Standard and Standard Satellite. This interim split chooses real building/aerial depth over another flat card, and it carries the required Mapbox, OpenStreetMap and Maxar credit.
3. **Final parity rule.** Static and GL must share the hosted Harlem style once it exists. The interim split is explicitly not parity: Standard cannot be rendered by Static Images today, and `satellite-streets-v12` cannot render 3D objects in GL. Do not switch only one side or claim the custom style is live before the upload below.

**Upload, by the account owner, once and then on each change** (a token with `styles:write`, kept in `.env.local`, never committed):

```sh
# create; prints the new style id
curl -X POST "https://api.mapbox.com/styles/v1/$MAPBOX_USER?access_token=$MAPBOX_WRITE_TOKEN" \
  -H 'Content-Type: application/json' --data @tooling/map-style/mights-dark.json
# update after re-running the generator
curl -X PATCH "https://api.mapbox.com/styles/v1/$MAPBOX_USER/$STYLE_ID?access_token=$MAPBOX_WRITE_TOKEN" \
  -H 'Content-Type: application/json' --data @tooling/map-style/mights-dark.json
```

Then set `STYLE = '$MAPBOX_USER/$STYLE_ID'` in `MightsMapImage.tsx` and `style: 'mapbox://styles/$MAPBOX_USER/$STYLE_ID'` in `ExploreMap.tsx`. Static renders can lag a fresh PATCH by up to 12 hours (Mapbox cache), so compare static and GL captures after that window. `node tooling/map-style/build-map-style.mjs --check` fails when the committed JSON no longer matches tokens plus snapshot.

### Markers

4. DOM markers stay. Each is a `<button>` with `role="button"` set before `new mapboxgl.Marker`, a 44×44 hit area (`size-11`), `aria-pressed` for selection, the place name as its label, and a visible `focus-visible` outline. Selection changes shape and size (12 → 18 px diamond), adds a `text`-coloured ring and shows a name label beside the pin, so colour is never the only cue.
5. Move to a GeoJSON source plus symbol layer, with selection through `map.setFeatureState`, when any one of these holds: more than 150 mapped places, a need to cluster, or a marker update costing more than 16 ms on a 4× CPU trace. Layer features can't take focus, so from then on the list is the keyboard surface and selection is announced through the existing live region.

## Measurements

WCAG relative luminance on flat token colours. Antialiasing lowers real label contrast slightly; the audit sampled about 3.9:1 for dark-v11 POI labels against the 4.05:1 flat value below. dark-v11 values are its street-zoom stops.

| Pair | dark-v11 | Harlem Might dark | Floor |
|---|---|---|---|
| Road label on its halo | 8.42:1 | 7.57:1 | 4.5:1 |
| Road label on avenue fill (halo antialiased away) | 4.57:1 | 4.55:1 | 4.5:1 |
| Road label on ground | 6.12:1 | 7.57:1 | 4.5:1 |
| POI label on ground | **4.05:1** | hidden | 4.5:1 |
| Gold pin on ground | 9.07:1 | 12.40:1 | 3:1 |
| Gold pin on avenue | 6.77:1 | 7.46:1 | 3:1 |
| Gold pin on street | 6.77:1 | 9.59:1 | 3:1 |
| Gold pin on building | 10.28:1 | 11.65:1 | 3:1 |
| Gold pin on water | 10.28:1 | 11.62:1 | 3:1 |
| Gold pin on park | 9.51:1 | 10.95:1 | 3:1 |
| Avenue vs ground | 1.34:1 | 1.66:1 | none |

| Colour | dark-v11 | Harlem Might dark |
|---|---|---|
| ground | #292929 | #0B0906 (`surface`) |
| building | #1F1F1F | #15120D (`surface-raised`) |
| street | #3D3D3D | #2A241A (`border`) |
| avenue | #3D3D3D | #3D3628 (`border` → `border-strong`, 25%) |
| water | #1F1F1F | #0E1412 (`mights.night`) |
| park | #272525 | #131B16 (`verdigris` 10%) |
| label | #A8A8A8 | #A89F8B (`text-muted`) |
| halo | #080808 | #0B0906 (`surface`) |

Style size, minified: dark-v11 36.6 KB raw / 4.2 KB gzip, 50 layers. Harlem Might dark 36.3 KB raw / 4.1 KB gzip, same 50 layers with 3 hidden. Mapbox Standard, the other way to get a tinted map, is 332 KB raw and can't be rendered by Static Images.

`border-strong` was rejected for avenues: a gold pin on it measures 3.32:1, and a label whose halo antialiases away drops to 2.03:1.

**Not measured yet, because the style is not on the account:** static PNG bytes per frame (dark-v11 baseline 318–354 KB at 720×405@2x), GL tile and glyph bytes, `hm:map-ready`, and the 40% glare veil. Run audit §16's protocol once the upload lands, then decide the switch on those numbers.

## Consequences

- The marker fix clears axe `aria-allowed-attr` on `/explore`. Axe now reports 0 violations at 1280 and one at 390: `target-size` where Red Rooster's and Sylvia's 44 px hit areas overlap at the fit-bounds zoom. Both places have list rows of full width, which is the "equivalent control" exception in WCAG 2.5.8.
- `ExploreMap` now emits `hm:map-create`, `hm:map-idle` and the measure `hm:map-ready`. In headless Chrome on SwiftShader the measure read 6.0–6.3 s. That is software GL, so it is not a budget number; take the budget from a real-GPU Lighthouse trace.
- The style switch costs one account action and a two-line change.
