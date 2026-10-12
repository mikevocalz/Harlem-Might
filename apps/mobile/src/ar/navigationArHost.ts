import { createStore, type StoreApi } from 'zustand/vanilla';
import type { NavigationController } from '@acme/app/features/navigation/session/navigationController.ts';
import { createArVisit } from './navigationArVisit.ts';

export interface NavigationArHostState {
  readonly visit: ReturnType<typeof createArVisit> | undefined;
  open(): void;
  close(): void;
}

/** Owns one in-pane AR visit; the shared controller still owns the walking trip. */
export function createNavigationArHost(controller: NavigationController, initiallyOpen = false) {
  return createStore<NavigationArHostState>()((set, get) => ({
    visit: initiallyOpen ? createArVisit('navigation', controller) : undefined,
    /** Opens at most one visit without restarting the shared trip or watch. */
    open() {
      if (get().visit) return;
      set({ visit: createArVisit('navigation', controller) });
    },
    /** Releases this visit to map guidance while preserving the active walk. */
    close() {
      const visit = get().visit;
      if (!visit) return;
      visit.leave();
      set({ visit: undefined });
    },
  }));
}

/** Only a focused, visible map adopts shared AR state; hidden hosts release their own visit. */
export function syncNavigationArHost(host: StoreApi<NavigationArHostState>, input: {
  readonly focused: boolean;
  readonly showMap: boolean;
  readonly navigationInAr: boolean;
}): void {
  const state = host.getState();
  if (!input.focused || !input.showMap) {
    if (state.visit) state.close();
    return;
  }
  if (input.navigationInAr) state.open();
}

/** Geometry affects visible space, while backgrounding releases only the camera. */
export function navigationArHostPresentation(input: {
  readonly focused: boolean;
  readonly foreground: boolean;
  readonly showMap: boolean;
  readonly visitOpen: boolean;
  /** Lateral rails leave the content bottom safe area unconsumed. */
  readonly bottomInset?: number;
  readonly detailOverlayWidth: number;
  readonly discoverOverlayWidth: number;
}) {
  const hostVisible = input.focused && input.showMap && input.visitOpen;
  return {
    hostVisible,
    cameraAllowed: hostVisible && input.foreground,
    contentInsets: {
      top: 0,
      bottom: input.bottomInset ?? 0,
      left: input.discoverOverlayWidth,
      right: input.detailOverlayWidth,
    },
  };
}
