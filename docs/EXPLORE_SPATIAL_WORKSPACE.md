# Explore spatial workspace

Explore is the first production-shaped consumer of Harlem Might SplitView.

## Pane ownership

### Primary / Master
Discovery only: search, category filters, result roster, and later Near Me, Saved and Guides.

### Supplementary / Map
Spatial selection: map viewport, POI pins, route preview and selected place marker.

The current PR uses explicit preview geometry, not fake latitude/longitude. Nitro Mapbox AR replaces that preview with canonical PostGIS coordinates in the map integration PR.

### Secondary / Detail
The canonical Place surface: media, Why it matters, hours/current operations, menu/tickets, Story, accessibility, and sources/corrections.

### Inspector / Mights Panel
Fast selection context and actions only: save, Walk There, Enter AR, menu availability, accessibility/current-source summaries, verification freshness, and route/AR state.

Do not put long-form story content in the inspector.

## Compact flow

Explore starts on Map by setting topColumnForCollapsing to supplementary.

- Map -> Places -> Master
- selecting a pin/result -> Detail
- Back steps through the SplitView chain
- tablet/foldable/desktop uses the exact same mounted panes but tiles the allowed ones

## Data honesty

The eight seed records in this first UI slice are navigation/content-shape fixtures. They intentionally do not fabricate current hours, ratings, live event schedules, exact route distance, geographic coordinates, or verification timestamps. Those arrive from the canonical Payload/PostGIS/API pipeline.
