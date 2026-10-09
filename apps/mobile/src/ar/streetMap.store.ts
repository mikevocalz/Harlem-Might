import type { BuildingMesh } from '@mapbox/react-native-mapbox-ar-reactvision/src/buildings.ts';
import type { XyzTile } from '@mapbox/react-native-mapbox-ar-reactvision/src/tile.ts';
import { create } from 'zustand';

/**
 * The real map around the wearer, as the map layer (useStreetMap) loaded it.
 * `no-token` and `not-public` mean no buildings or imagery are shown and the
 * scene says why.
 */
export type StreetMapStatus = 'off' | 'no-token' | 'not-public' | 'loading' | 'ready' | 'partial';

export interface StreetMapState {
  readonly status: StreetMapStatus;
  /** Building meshes for the current tile set, nearest tile first. */
  readonly meshes: readonly BuildingMesh[];
  readonly imageryTiles: readonly XyzTile[];
  /** Building tiles that failed to load in the current set. */
  readonly failedTiles: number;
  set: (next: Partial<Omit<StreetMapState, 'set' | 'reset'>>) => void;
  reset: () => void;
}

const INITIAL = { status: 'off', meshes: [], imageryTiles: [], failedTiles: 0 } as const;

export const useStreetMap = create<StreetMapState>((set) => ({
  ...INITIAL,
  set: (next) => set(next),
  reset: () => set(INITIAL),
}));

/** Building parts drawn at the default height because the source had none. */
export function estimatedHeightCount(meshes: readonly BuildingMesh[]): number {
  return meshes.reduce((sum, mesh) => sum + mesh.estimatedHeightCount, 0);
}
