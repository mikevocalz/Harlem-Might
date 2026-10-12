import { createStore } from 'zustand/vanilla';
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
    open() {
      if (get().visit) return;
      set({ visit: createArVisit('navigation', controller) });
    },
    close() {
      const visit = get().visit;
      if (!visit) return;
      visit.leave();
      set({ visit: undefined });
    },
  }));
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
