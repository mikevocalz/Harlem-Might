import { useEffect, useRef } from 'react';
import type { MetaWindowPlacement } from '@viro-external/meta-layout';
import { spatialPanels } from '../../modules/spatial-panels';
import { isHorizonBuild } from './horizonBuild';
import { placeDetailPlacement } from './placeDetailPanel';
import { usePlaceDetailPanelStore } from './placeDetailPanel.store';
import { attachPlaceDetailPanel } from './placeDetailPanelRuntime';

/**
 * Shows Place Detail as its own Horizon OS panel beside the main window
 * while a place is selected (DECISIONS S20, ADR 0006), and returns Detail's
 * placement for `resolveExploreLayout`.
 *
 * - Selecting a place opens the panel; selecting another updates it in place
 *   (it reads the same `useExplore` store).
 * - Clearing the selection closes it.
 * - Closing the panel itself (its Close button, Back, or the OS) calls
 *   `onClosedByUser`, which clears the selection. While unmounted, the
 *   session clears selection itself and defers layout/navigation cleanup to
 *   the next owner, unless a newer selection has superseded the dismissal.
 * - Where panels are unavailable, or the launch fails, the result is
 *   `inline` and the S17 column shows Detail in the main window.
 *
 * Mount once, in the Explore layout.
 */
export function usePlaceDetailPanel(input: {
  selectedPlaceId: string | null;
  onClosedByUser: () => void;
}): MetaWindowPlacement {
  const { selectedPlaceId } = input;
  const status = usePlaceDetailPanelStore((state) => state.status);
  const isAvailable = isHorizonBuild && spatialPanels.isAvailable;
  const panelOwner = useRef<ReturnType<typeof attachPlaceDetailPanel> | null>(null);

  const onClosedByUser = useRef(input.onClosedByUser);
  useEffect(() => {
    onClosedByUser.current = input.onClosedByUser;
  });

  useEffect(() => {
    if (!isAvailable) return;
    const owner = attachPlaceDetailPanel(() => onClosedByUser.current());
    panelOwner.current = owner;
    return () => {
      owner.detach();
      if (panelOwner.current === owner) panelOwner.current = null;
    };
  }, [isAvailable]);

  useEffect(() => {
    panelOwner.current?.sync();
  }, [selectedPlaceId, status, isAvailable]);

  return placeDetailPlacement(status);
}
