import { useExplore } from '@acme/app';
import { dismissRetainedExplorePlaceRoute } from '../navigation/explorePlaceRoute';
import { spatialPanels } from '../../modules/spatial-panels';
import { PLACE_DETAIL_PANEL, placeDetailPanelCommand } from './placeDetailPanel';
import { usePlaceDetailPanelStore } from './placeDetailPanel.store';

type PanelOwner = { onClosedByUser: () => void };

// Native activities and their events outlive Explore mounts. Lazily keep one
// session until neither the panel nor a deferred user dismissal needs it. There
// are no native subscriptions at import time, and no unmounted UI callbacks.
let session: ReturnType<typeof createPanelSession> | null = null;

function createPanelSession() {
  let active = true;
  let owner: PanelOwner | null = null;
  let pendingOpenAttempt: object | null = null;
  let closeAttempt: object | null = null;
  let pendingUserClose = false;
  const setStatus = usePlaceDetailPanelStore.getState().setStatus;

  function releaseIfIdle() {
    if (!active) return;
    const status = usePlaceDetailPanelStore.getState().status;
    if (owner || pendingUserClose || status === 'opening' || status === 'open'
      || (status === 'failed' && useExplore.getState().selectedPlaceId != null)) return;
    active = false;
    opened.remove();
    closed.remove();
    unsubscribeSelection();
    if (session === runtime) session = null;
  }

  async function open() {
    // A successful promise means only that startActivity was dispatched. Keep
    // the attempt until an event or failure, including across effect replay.
    if (!active || pendingOpenAttempt || usePlaceDetailPanelStore.getState().status !== 'closed') return;
    const attempt = {};
    pendingOpenAttempt = attempt;
    setStatus('opening');
    try {
      await spatialPanels.openPanel(PLACE_DETAIL_PANEL);
    } catch (error: unknown) {
      if (!active || pendingOpenAttempt !== attempt) return;
      pendingOpenAttempt = null;
      console.warn(`[spatial] Place Detail panel did not open; showing Detail in the main window. ${String(error)}`);
      setStatus(useExplore.getState().selectedPlaceId == null ? 'closed' : 'failed');
      releaseIfIdle();
    }
  }

  async function close() {
    if (!active || closeAttempt) return;
    const attempt = {};
    closeAttempt = attempt;
    try {
      await spatialPanels.closePanel(PLACE_DETAIL_PANEL);
    } catch (error: unknown) {
      if (!active || closeAttempt !== attempt) return;
      console.warn(`[spatial] Place Detail panel did not close. ${String(error)}`);
      // Only the native closed event confirms absence. Keep the truthful
      // status and retry when a later selection is cleared, never in a loop.
    }
  }

  const opened = spatialPanels.addOnPanelOpenedListener(({ name }) => {
    if (!active || name !== PLACE_DETAIL_PANEL) return;
    pendingOpenAttempt = null;
    closeAttempt = null;
    setStatus('open');
    // An earlier close while opening may have had nothing to close yet.
    if (useExplore.getState().selectedPlaceId == null) void close();
  });
  const closed = spatialPanels.addOnPanelClosedListener(({ name, reason }) => {
    if (!active || name !== PLACE_DETAIL_PANEL) return;
    pendingOpenAttempt = null;
    closeAttempt = null;
    setStatus('closed');
    if (reason === 'user') {
      if (owner) {
        owner.onClosedByUser();
      } else {
        // Close the shared Detail immediately. The next mounted layout owns
        // directions, compact-pane and router cleanup (dismissDetail); never
        // call the layout that unmounted. A new selection cancels this intent.
        pendingUserClose = true;
        dismissRetainedExplorePlaceRoute();
        useExplore.getState().closePlace();
      }
    }
    releaseIfIdle();
  });
  const unsubscribeSelection = useExplore.subscribe((state, previous) => {
    if (!active || state.selectedPlaceId === previous.selectedPlaceId) return;
    if (state.selectedPlaceId != null) {
      pendingUserClose = false;
      closeAttempt = null;
    } else {
      const status = usePlaceDetailPanelStore.getState().status;
      if (!owner && (status === 'opening' || status === 'open')) void close();
      else if (status === 'failed') setStatus('closed');
    }
    releaseIfIdle();
  });

  const runtime = {
    attach(onClosedByUser: () => void) {
      const nextOwner = { onClosedByUser };
      owner = nextOwner;
      return {
        sync() {
          if (!active || owner !== nextOwner) return;
          if (pendingUserClose) {
            pendingUserClose = false;
            nextOwner.onClosedByUser();
          }
          const selectedPlaceId = useExplore.getState().selectedPlaceId;
          const status = usePlaceDetailPanelStore.getState().status;
          const command = placeDetailPanelCommand({ selectedPlaceId, status, isAvailable: true });
          if (command === 'open') void open();
          else if (command === 'close') void close();
          else if (selectedPlaceId == null && status === 'failed') setStatus('closed');
        },
        detach() {
          if (owner !== nextOwner) return;
          owner = null;
          // A store clear may have landed before this layout's next effect.
          const status = usePlaceDetailPanelStore.getState().status;
          if (useExplore.getState().selectedPlaceId == null && (status === 'opening' || status === 'open')) void close();
          releaseIfIdle();
        },
      };
    },
  };
  return runtime;
}

/** Acquire the current native session without transferring any old UI callback. */
export function attachPlaceDetailPanel(onClosedByUser: () => void) {
  session ??= createPanelSession();
  return session.attach(onClosedByUser);
}
