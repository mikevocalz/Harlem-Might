import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { WorkspaceDefinition } from '@viro-external/xr-contract';
import { META_OFFSET_STEPS } from '@viro-external/meta-layout';
import {
  EXPLORE_SURFACE,
  EXPLORE_WORKSPACE,
  findExploreEntry,
  PLACE_DETAIL_OFFSET,
  PLACE_DETAIL_WINDOW,
  resolveExploreWorkspace,
} from './exploreWorkspace.ts';

const summary = (selectedPlaceId: string | null, isSpatialAvailable: boolean) =>
  resolveExploreWorkspace({ selectedPlaceId, isSpatialAvailable }).entries.map((entry) =>
    entry.kind === 'inline' ? [entry.kind, entry.surface.id, entry.region, entry.reason] : [entry.kind, entry.surface.id],
  );

describe('Explore workspace on Meta Horizon OS (S17: one window, three columns)', () => {
  it('keeps Place Detail inside the main window, in the trailing column, on a spatial runtime', () => {
    const resolution = resolveExploreWorkspace({ selectedPlaceId: 'apollo', isSpatialAvailable: true });

    assert.equal(resolution.workspaceId, 'harlem-explore');
    assert.equal(resolution.windowBudget, 0);
    assert.deepEqual(summary('apollo', true), [
      ['main', 'map'],
      ['inline', 'discover', 'leading', 'layer'],
      ['inline', 'place-detail', 'trailing', 'layer'],
    ]);
    assert.deepEqual(resolution.omitted, []);
  });

  it('resolves the same way with and without a spatial runtime', () => {
    for (const selectedPlaceId of [null, 'apollo']) {
      assert.deepEqual(summary(selectedPlaceId, true), summary(selectedPlaceId, false), String(selectedPlaceId));
    }
  });

  it('never mounts Place Detail without a selection (S5)', () => {
    const resolution = resolveExploreWorkspace({ selectedPlaceId: null, isSpatialAvailable: true });

    assert.equal(findExploreEntry(resolution, EXPLORE_SURFACE.placeDetail), undefined);
    assert.deepEqual(
      resolution.omitted.map((omitted) => [omitted.surface.id, omitted.reason]),
      [['place-detail', 'not-mounted']],
    );
    assert.equal(findExploreEntry(resolution, EXPLORE_SURFACE.discover)?.kind, 'inline');
  });

  it('declares no window surface and never promotes the map', () => {
    const map = EXPLORE_WORKSPACE.surfaces.find((surface) => surface.id === EXPLORE_SURFACE.map);
    assert.equal(map?.presentation.kind, 'main');
    assert.deepEqual(
      EXPLORE_WORKSPACE.surfaces.filter((surface) => surface.presentation.kind === 'window'),
      [],
    );
  });
});

describe('Deferred "Open in new window" (ADR 0004)', () => {
  // The window presentation is kept so the opt-in can return. Prove it still
  // resolves to the props the S12 window used, with the depth-only offset.
  const withDetailWindow: WorkspaceDefinition = {
    ...EXPLORE_WORKSPACE,
    maxPromotedSurfaces: 1,
    surfaces: EXPLORE_WORKSPACE.surfaces.map((surface) =>
      surface.id === EXPLORE_SURFACE.placeDetail ? { ...surface, presentation: PLACE_DETAIL_WINDOW } : surface,
    ),
  };

  it('still resolves Place Detail to a 440x600 end-anchored window when swapped in', () => {
    const entry = findExploreEntry(
      resolveExploreWorkspace({ selectedPlaceId: 'apollo', isSpatialAvailable: true, definition: withDetailWindow }),
      EXPLORE_SURFACE.placeDetail,
    );
    assert.equal(entry?.kind, 'window');
    if (entry?.kind !== 'window') throw new Error('unreachable');
    assert.deepEqual(entry.window, {
      label: 'place-detail',
      windowWidth: 440,
      windowHeight: 600,
      priority: 10,
      promotable: true,
      fallback: 'inline',
      anchor: { parent: 'end', child: 'start' },
      offset: { z: META_OFFSET_STEPS.near },
    });
    assert.equal('start' in PLACE_DETAIL_OFFSET, false);
  });

  it('falls back inline to the trailing column without a spatial runtime', () => {
    const entry = findExploreEntry(
      resolveExploreWorkspace({ selectedPlaceId: 'apollo', isSpatialAvailable: false, definition: withDetailWindow }),
      EXPLORE_SURFACE.placeDetail,
    );
    assert.deepEqual(
      entry?.kind === 'inline' ? [entry.region, entry.reason] : entry?.kind,
      ['trailing', 'no-spatial-runtime'],
    );
  });
});
