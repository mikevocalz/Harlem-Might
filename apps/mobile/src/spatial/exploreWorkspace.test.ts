import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { META_OFFSET_STEPS, type MetaWindowProps } from '@viro-external/meta-layout';
import {
  EXPLORE_SURFACE,
  EXPLORE_WORKSPACE,
  findExploreEntry,
  PLACE_DETAIL_OFFSET,
  resolveExploreWorkspace,
} from './exploreWorkspace.ts';

function windowProps(selectedPlaceId: string | null, surfaceId: string): MetaWindowProps {
  const entry = findExploreEntry(
    resolveExploreWorkspace({ selectedPlaceId, isSpatialAvailable: true }),
    surfaceId,
  );
  assert.equal(entry?.kind, 'window', `${surfaceId} should resolve to a window`);
  if (entry?.kind !== 'window') throw new Error('unreachable');
  return entry.window;
}

describe('Explore workspace on Meta Horizon OS (S12)', () => {
  it('promotes only Place Detail; Discover stays in the main window', () => {
    const resolution = resolveExploreWorkspace({ selectedPlaceId: 'apollo', isSpatialAvailable: true });

    assert.equal(resolution.workspaceId, 'harlem-explore');
    assert.equal(resolution.windowBudget, 1);
    assert.deepEqual(
      resolution.entries.map((entry) =>
        entry.kind === 'inline' ? [entry.kind, entry.surface.id, entry.region, entry.reason] : [entry.kind, entry.surface.id],
      ),
      [
        ['main', 'map'],
        ['window', 'place-detail'],
        ['inline', 'discover', 'leading', 'layer'],
      ],
    );
    assert.deepEqual(resolution.omitted, []);
  });

  it('gives Place Detail the S12 window props: 440x600, end edge, gutter plus depth, priority 10', () => {
    assert.deepEqual(windowProps('apollo', EXPLORE_SURFACE.placeDetail), {
      label: 'place-detail',
      windowWidth: 440,
      windowHeight: 600,
      priority: 10,
      promotable: true,
      fallback: 'inline',
      anchor: { parent: 'end', child: 'start' },
      offset: { start: -META_OFFSET_STEPS.near, z: META_OFFSET_STEPS.near },
    });
    assert.equal(PLACE_DETAIL_OFFSET.start, -META_OFFSET_STEPS.near);
  });

  it('never mounts Place Detail without a selection, and Discover is never a window', () => {
    const resolution = resolveExploreWorkspace({ selectedPlaceId: null, isSpatialAvailable: true });

    assert.equal(findExploreEntry(resolution, EXPLORE_SURFACE.placeDetail), undefined);
    assert.deepEqual(
      resolution.omitted.map((omitted) => [omitted.surface.id, omitted.reason]),
      [['place-detail', 'not-mounted']],
    );
    assert.equal(findExploreEntry(resolution, EXPLORE_SURFACE.discover)?.kind, 'inline');
  });

  it('keeps Place Detail inline in the trailing pane without a spatial runtime', () => {
    const resolution = resolveExploreWorkspace({ selectedPlaceId: 'apollo', isSpatialAvailable: false });

    assert.deepEqual(
      resolution.entries.map((entry) =>
        entry.kind === 'inline' ? [entry.surface.id, entry.region, entry.reason] : [entry.surface.id, entry.kind],
      ),
      [
        ['map', 'main'],
        ['discover', 'leading', 'layer'],
        ['place-detail', 'trailing', 'no-spatial-runtime'],
      ],
    );
  });

  it('declares exactly one window surface and never promotes the map', () => {
    const map = EXPLORE_WORKSPACE.surfaces.find((surface) => surface.id === EXPLORE_SURFACE.map);
    assert.equal(map?.presentation.kind, 'main');

    const windows = EXPLORE_WORKSPACE.surfaces.filter((surface) => surface.presentation.kind === 'window');
    assert.deepEqual(
      windows.map((surface) => surface.id),
      ['place-detail'],
    );

    for (const selectedPlaceId of [null, 'apollo']) {
      const resolution = resolveExploreWorkspace({ selectedPlaceId, isSpatialAvailable: true });
      const promoted = resolution.entries.filter((entry) => entry.kind === 'window');
      assert.ok(promoted.length <= resolution.windowBudget);
      assert.ok(promoted.every((entry) => entry.surface.id === EXPLORE_SURFACE.placeDetail));
    }
  });
});
