# Harlem Might · Shared Experience Widgets

Typed, dependency-light contracts used by iOS Expo Widgets, Android home widgets,
Apple Watch, Wear OS, and the Harlem Might mobile/web app.

This package **does not render native UI** and does **not** contact the database.
It prepares safe, glanceable, versioned snapshots in the host app or trusted API.
Native extensions consume those snapshots through platform adapters. Do not
import React Native, Pulsar, Better Auth, API keys, or a full Payload document here.

## Contract

- Published, sourced stories become the daily editorial highlight in Harlem-local time.
- Events require source verification in the last 48h, valid start/end times and scheduled status.
  Never display cancelled, stale, or unverified events as current.
- My Places contains only explicitly saved canonical CMS place ids.
- My Walk shows the next *confirmed* stop; location presence alone is not arrival.
- Snapshot data is public and compact; private locations and credentials never enter it.
- Deep links are allowlisted, not interpolated from an arbitrary external URL.
- Never invent content: when a card is null, native surfaces show an honest empty state.

## API

```ts
import { buildWidgetSnapshot, beginWalk, confirmStop } from '@acme/widgets';

const snapshot = buildWidgetSnapshot(
  { stories: [], events: [], places: [], savedPlaceIds: [] },
  new Date().toISOString()
); // empty, never fake data
```

Test with `pnpm --filter @acme/widgets test` and
`pnpm --filter @acme/widgets typecheck`. App and native target integration
must run separately on real devices: no claim of Apple Watch or Wear OS support
until compiled and exercised with the official SDKs.

## Ownership

The server curates and authorizes content, and the host computes the snapshot.
The iOS widget extension must only render passed props; Android receives the
same serialized card model. The watch bridge uses `WalkSession` and a separate
secure sync transport with explicit member authentication (anonymous tours still
work offline). Place routes follow the existing /explore?place=slug IA.

The companion handoff must record source freshness, honor location and notification
permissions, never initiate geofencing without consent, and never require tracking
to browse stories and events.
