import type { NavigationController } from '@acme/app/features/navigation/session/navigationController.ts';
import type { NavigationSession } from '@acme/app/features/navigation/model/session.ts';

/**
 * Whether this build and device may run phone AR navigation. Headsets have
 * no GPS and run the quest/pico flavors; their AR route keeps the tabletop
 * and street-scale scenes, and none of the ARCore geospatial code below is
 * reached there.
 */
export function canUseArNavigation(input: {
  readonly isHorizonBuild: boolean;
  readonly isMetaHorizonXR: boolean;
  readonly isPico: boolean;
  readonly isVisionOS: boolean;
  readonly platform: string;
}): boolean {
  if (input.isHorizonBuild || input.isMetaHorizonXR || input.isPico || input.isVisionOS) return false;
  return input.platform === 'ios' || input.platform === 'android';
}

/**
 * Keep Harlem's existing street/tabletop worlds available without navigation.
 * Phone navigation is an additive AR experience, not a replacement for the
 * map, headset street world, or existing tabletop scene.
 */
export type ArExperience = 'tabletop' | 'street' | 'navigation';

export function chooseArExperience(input: {
  readonly requestedScene: 'tabletop' | 'street';
  readonly navigationAvailable: boolean;
  readonly navigationSessionInAR: boolean;
}): ArExperience {
  return input.navigationAvailable && input.navigationSessionInAR
    ? 'navigation'
    : input.requestedScene;
}

/**
 * Moves an active walk into AR and returns whether the AR route should open.
 * Call it from the map's "View in AR" action, then push `/explore-ar`. The
 * session, route and progress carry over unchanged.
 */
export function enterArNavigation(controller: NavigationController): boolean {
  return controller.enterAR();
}

/** A walk from this device that can carry its existing route into phone AR. */
export function arEntryRoute(session: NavigationSession) {
  if (session.phase !== 'routeReady' && session.phase !== 'navigating') return undefined;
  if (session.mode !== 'walking' || session.origin.kind !== 'device-location') return undefined;
  return session.phase === 'routeReady' ? session.routes[session.selectedRouteIndex] : session.activeRoute.route;
}

/** Native preflight results; none of the failure states changes the map trip. */
export type ArEntryResult = 'opened' | 'busy' | 'cancelled' | 'unsupported' | 'camera-denied' | 'unavailable';

/**
 * One cancellable preflight shared by both directions and map entry buttons.
 * Native prompts finish asynchronously; revalidate the exact selected route
 * before each prompt and before starting guidance, so Cancel or a newer trip
 * can never open the old walk. No routes or controllers are created here.
 */
export function createArNavigationEntry(deps: {
  readonly getSession: () => NavigationSession;
  readonly supported: () => Promise<boolean>;
  readonly requestCamera: () => Promise<boolean>;
  readonly startGuidance: () => boolean;
  readonly enterAR: () => boolean;
  readonly exitAR: () => boolean;
  readonly setPending: (pending: boolean) => void;
}) {
  let pending = false;
  return {
    async open(onOpen: () => void, isCurrent: () => boolean): Promise<ArEntryResult> {
      if (pending) return 'busy';
      const route = arEntryRoute(deps.getSession());
      const current = () => isCurrent() && route !== undefined && arEntryRoute(deps.getSession()) === route;
      if (!current()) return 'cancelled';
      pending = true;
      deps.setPending(true);
      let entered = false;
      try {
        const supported = await deps.supported();
        if (!current()) return 'cancelled';
        if (!supported) return 'unsupported';
        const camera = await deps.requestCamera();
        if (!current()) return 'cancelled';
        if (!camera) return 'camera-denied';
        if (deps.getSession().phase === 'routeReady' && !deps.startGuidance()) return 'cancelled';
        if (!deps.enterAR()) return 'cancelled';
        entered = true;
        onOpen();
        return 'opened';
      } catch {
        if (entered) {
          deps.exitAR();
          return 'unavailable';
        }
        return current() ? 'unavailable' : 'cancelled';
      } finally {
        pending = false;
        deps.setPending(false);
      }
    },
  };
}
