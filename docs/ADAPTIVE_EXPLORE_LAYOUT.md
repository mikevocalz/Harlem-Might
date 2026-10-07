# Harlem Might adaptive Explore layout

This document defines the product meaning of SplitView for Harlem Might. It is not a generic "put three things in three columns" recipe.

## The four surfaces

### 1. Master / Primary — Discovery

The master pane owns **discovery state**, not place content.

It contains:
- search
- categories and filters
- Near Me
- Saved
- curated guides / lists
- result roster
- list/map mode controls when needed

Selecting a result changes spatial selection and can open the detail route.

### 2. Supplementary — Map

The supplementary pane is the **spatial selection workspace**.

It contains:
- Mapbox map
- POI pins/clusters
- route preview
- current viewport/search area
- selected block/place marker
- draggable map/list affordances where appropriate

It is intentionally not the canonical place article. On compact phones it is the preferred first Explore surface.

### 3. Secondary / Detail — Place

The secondary/detail pane is the canonical Place view.

It contains:
- image carousel
- summary / Why it matters
- hours and current operating status
- menus (image/PDF/official web)
- story/history
- events
- accessibility
- related people/places
- sources / corrections

Long-form content belongs here. Do not duplicate it into the inspector.

### 4. Inspector — Mights Panel

The inspector is **transient context and actions about the current selection**.

Use it for:
- Save / unsave
- Walk There
- Enter AR
- Share
- open / closed
- distance / walking ETA
- next event
- menu availability
- accessibility-at-a-glance
- source freshness / last verified
- route progress / next maneuver
- AR calibration / anchor status
- compact Rive HMI states

It must not become another detail page, another navigation sidebar, or a permanent fourth column.

The inspector overlays the trailing edge (SplitView.Inspector semantics). On a foldable it is capped to the trailing physical segment and must never cover the hinge or the opposite display.

## Size-class behavior

| Width class | Explore composition |
| --- | --- |
| compact <600 | one pane at a time; Map is the preferred Explore entry; Master is reachable as discovery; selection advances to Detail |
| medium 600–839 | Map + Detail; primary discovery moves to navigation/filter affordances |
| expanded 840–1199 | narrow Master rail + Map + Detail |
| large 1200–1599 | full Master + Map + Detail; Mights Panel available |
| extraLarge >=1600 | full Master + Map + Detail; expanded shell rail; Mights Panel available |

## Foldables

Web reads two independent signals when available:

1. Device Posture — `continuous` vs `folded`.
2. Viewport Segments — actual physical viewport rectangles.

The APIs are experimental/limited, so width classes remain the fallback.

### Book posture / side-by-side segments

For a 2-segment book posture:
- leading segment: Master + Map
- trailing segment: Detail
- hinge: explicit non-interactive gap
- Inspector: overlays only the trailing segment

For a 3-segment/trifold viewport, the three authored panes can map one-per-physical-region when all minimum widths fit.

### Tabletop / stacked segments

The web posture layer reports a horizontal fold as `tabletop`. The generic SplitView does not invent which authored content moves above/below the hinge. Explore should use:
- upper segment: Map / live spatial canvas
- lower segment: Detail / controls
- Master: bottom/rail discovery affordance
- Inspector: contextual sheet/overlay inside the lower segment

That host-specific composition is intentional: a generic layout primitive must not decide product content.

## Tailwind / CSS

Tailwind v4 does not need a special plugin for foldables.

For repeated CSS-only cases, it supports custom variants and arbitrary at-rule variants, so web-only styles can define variants for:
- `@media (device-posture: folded)`
- `@media (horizontal-viewport-segments: 2)`
- `@media (vertical-viewport-segments: 2)`

For the SplitView itself, JavaScript segment geometry is the source because the app must also:
- cap the inspector to one physical segment,
- preserve multi-hinge geometry,
- share the same planner with native,
- respond to posture changes.

Do not encode hinge geometry as a pile of width breakpoints.
