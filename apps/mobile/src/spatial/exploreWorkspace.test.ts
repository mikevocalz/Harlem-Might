import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MetaWindowProps } from '@viro-external/meta-layout';
import {
  EXPLORE_SURFACE,
  EXPLORE_WORKSPACE,
  findExploreEntry,
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

describe('Explore workspace on Meta Horizon OS', () => {
  it('promotes Discover and Place Detail beside the map when a place is selected', () => {
    const resolution = resolveExploreWorkspace({ selectedPlaceId: 'apollo', isSpatialAvailable: true });

    assert.equal(resolution.workspaceId, 'harlem-explore');
    assert.equal(resolution.windowBudget, 2);
    assert.deepEqual(
      resolution.entries.map((entry) => [entry.kind, entry.surface.id]),
      [
        ['main', 'map'],
        // Slot order: Detail (priority 20) before Discover (10).
        ['window', 'place-detail'],
        ['window', 'discover'],
      ],
    );
    assert.deepEqual(resolution.omitted, []);
  });

  it('gives each window the props SpatialWindow takes, labelled by surface id', () => {
    assert.deepEqual(windowProps('apollo', EXPLORE_SURFACE.discover), {
      label: 'discover',
      windowWidth: 360,
      windowHeight: 600,
      priority: 10,
      promotable: true,
      fallback: 'inline',
      anchor: { parent: 'start', child: 'end' },
      offset: { z: 1 },
    });
    assert.deepEqual(windowProps('apollo', EXPLORE_SURFACE.placeDetail), {
      label: 'place-detail',
      windowWidth: 440,
      windowHeight: 600,
      priority: 20,
      promotable: true,
      fallback: 'inline',
      anchor: { parent: 'end', child: 'start' },
      offset: { z: 1 },
    });
  });

  it('never mounts Place Detail without a selection', () => {
    const resolution = resolveExploreWorkspace({ selectedPlaceId: null, isSpatialAvailable: true });

    assert.equal(findExploreEntry(resolution, EXPLORE_SURFACE.placeDetail), undefined);
    assert.deepEqual(
      resolution.omitted.map((omitted) => [omitted.surface.id, omitted.reason]),
      [['place-detail', 'not-mounted']],
    );
    assert.equal(findExploreEntry(resolution, EXPLORE_SURFACE.discover)?.kind, 'window');
  });

  it('keeps both surfaces inline in their SplitView panes without a spatial runtime', () => {
    const resolution = resolveExploreWorkspace({ selectedPlaceId: 'apollo', isSpatialAvailable: false });

    assert.deepEqual(
      resolution.entries.map((entry) =>
        entry.kind === 'inline' ? [entry.surface.id, entry.region, entry.reason] : [entry.surface.id, entry.kind],
      ),
      [
        ['map', 'main'],
        ['discover', 'leading', 'no-spatial-runtime'],
        ['place-detail', 'trailing', 'no-spatial-runtime'],
      ],
    );
  });

  it('never promotes the map and stays within the two-window budget', () => {
    const map = EXPLORE_WORKSPACE.surfaces.find((surface) => surface.id === EXPLORE_SURFACE.map);
    assert.equal(map?.presentation.kind, 'main');

    const windows = EXPLORE_WORKSPACE.surfaces.filter((surface) => surface.presentation.kind === 'window');
    assert.deepEqual(
      windows.map((surface) => surface.id),
      ['discover', 'place-detail'],
    );

    for (const selectedPlaceId of [null, 'apollo']) {
      const resolution = resolveExploreWorkspace({ selectedPlaceId, isSpatialAvailable: true });
      const promoted = resolution.entries.filter((entry) => entry.kind === 'window');
      assert.ok(promoted.length <= resolution.windowBudget);
      assert.ok(promoted.every((entry) => entry.surface.id !== EXPLORE_SURFACE.map));
    }
  });
});
