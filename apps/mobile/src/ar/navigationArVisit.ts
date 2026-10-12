import type { NavigationController } from '@acme/app/features/navigation/session/navigationController.ts';
import { endNavigation } from '@acme/app/features/navigation/view/runtime.ts';
import { useExplore } from '@acme/app/features/explore/explore.store.ts';
import { useExploreLayoutStore } from '../spatial/exploreLayout.store';
import type { ArExperience } from './arNavigationEntry';

// Assigned at attachment, never during render. Only the newest mounted phone
// visit may release the shared AR session on asynchronous unmount cleanup.
let attachedNavigationVisit: symbol | undefined;

/**
 * One route visit owns one experience. Losing AR, ending a walk or reaching
 * its destination must never replace the camera with the tabletop renderer.
 * Keep this object in a ref, independent of geometry and session updates.
 */
export function createArVisit(experience: ArExperience, controller: NavigationController) {
  let attachment = 0;
  const owner = Symbol('navigation AR visit');
  const leave = () => {
    if (experience !== 'navigation') return;
    if (attachedNavigationVisit !== undefined && attachedNavigationVisit !== owner) return;
    controller.exitAR();
    // Arrived sessions do not transition in exitAR; clear their camera too.
    controller.setArTracking({ kind: 'off' });
    if (attachedNavigationVisit === owner) attachedNavigationVisit = undefined;
  };
  return {
    experience,
    /** Back, hardware Back and unmount leave AR without ending the walk. */
    leave,
    /** Effect replay is not a route exit. A real unmount leaves on this microtask. */
    attach() {
      const current = ++attachment;
      if (experience === 'navigation') attachedNavigationVisit = owner;
      return () => queueMicrotask(() => {
        if (attachment === current && attachedNavigationVisit === owner) leave();
      });
    },
  };
}

/** Ending from either arrival or the HUD stops the runtime's location watch. */
export function finishArNavigation() {
  endNavigation();
}

/** Back from AR exposes the map even if entry came from the directions pane. */
export function prepareArMapReturn() {
  const layout = useExploreLayoutStore.getState();
  layout.setCompactPane('map');
  layout.setDiscoverDrawerOpen(false);
}

/** Arrival explicitly opens Detail; generic route dismissal must preserve this intent. */
export function prepareArPlaceReturn(placeId: string | undefined) {
  if (!placeId) {
    prepareArMapReturn();
    return;
  }
  useExplore.getState().openPlace(placeId, null);
  const layout = useExploreLayoutStore.getState();
  layout.showCompactDetail('map');
  layout.setDiscoverDrawerOpen(false);
}
