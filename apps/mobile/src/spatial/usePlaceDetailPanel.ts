import { useEffect, useRef } from 'react';
import type { MetaWindowPlacement } from '@viro-external/meta-layout';
import { useExplore } from '@acme/app';
import { spatialPanels } from '../../modules/spatial-panels';
import { isHorizonBuild } from './horizonBuild';
import {
  PLACE_DETAIL_PANEL,
  placeDetailPanelCommand,
  placeDetailPlacement,
} from './placeDetailPanel';
import { usePlaceDetailPanelStore } from './placeDetailPanel.store';

/**
 * Shows Place Detail as its own Horizon OS panel beside the main window
 * while a place is selected (DECISIONS S20, ADR 0006), and returns Detail's
 * placement for `resolveExploreLayout`.
 *
 * - Selecting a place opens the panel; selecting another updates it in place
 *   (it reads the same `useExplore` store).
 * - Clearing the selection closes it.
 * - Closing the panel itself (its Close button, Back, or the OS) calls
 *   `onClosedByUser`, which clears the selection.
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
  const setStatus = usePlaceDetailPanelStore((state) => state.setStatus);
  const isAvailable = isHorizonBuild && spatialPanels.isAvailable;
  const command = placeDetailPanelCommand({ selectedPlaceId, status, isAvailable });

  const onClosedByUser = useRef(input.onClosedByUser);
  useEffect(() => {
    onClosedByUser.current = input.onClosedByUser;
  });

  useEffect(() => {
    if (!isAvailable) return;
    const opened = spatialPanels.addOnPanelOpenedListener(({ name }) => {
      if (name !== PLACE_DETAIL_PANEL) return;
      // The selection was cleared while the OS was still opening the panel,
      // when closePanel had nothing to close yet.
      if (useExplore.getState().selectedPlaceId == null) {
        void spatialPanels.closePanel(PLACE_DETAIL_PANEL);
        return;
      }
      setStatus('open');
    });
    const closed = spatialPanels.addOnPanelClosedListener(({ name, reason }) => {
      if (name !== PLACE_DETAIL_PANEL) return;
      setStatus('closed');
      if (reason === 'user') onClosedByUser.current();
    });
    return () => {
      opened.remove();
      closed.remove();
    };
  }, [isAvailable, setStatus]);

  useEffect(() => {
    if (command === 'open') {
      setStatus('opening');
      spatialPanels.openPanel(PLACE_DETAIL_PANEL).catch((error: unknown) => {
        console.warn(`[spatial] Place Detail panel did not open; showing Detail in the main window. ${String(error)}`);
        setStatus('failed');
      });
    } else if (command === 'close') {
      spatialPanels.closePanel(PLACE_DETAIL_PANEL).catch((error: unknown) => {
        console.warn(`[spatial] Place Detail panel did not close. ${String(error)}`);
      });
    }
  }, [command, setStatus]);

  // A failed launch is retried on the next selection, not the same one.
  useEffect(() => {
    if (selectedPlaceId == null && status === 'failed') setStatus('closed');
  }, [selectedPlaceId, status, setStatus]);

  return placeDetailPlacement(status);
}
