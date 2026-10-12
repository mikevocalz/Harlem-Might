import type { NavigationController } from '@acme/app/features/navigation/session/navigationController.ts';
import type { NavigationSession } from '@acme/app/features/navigation/model/session.ts';

/**
 * Builds that use the iOS/Android walking renderer. Headset-specific builds
 * retain their existing tabletop/street experience. Native AR support and
 * permission are checked separately at explicit entry.
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

/** Selects navigation for an eligible AR session, otherwise retaining the requested world. */
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
 * Call it from the map's walking-AR action, then reveal its in-pane host. The
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

/** Failed preflight preserves the map trip; failure after starting guidance may leave map guidance active. */
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
    /** Revalidates native preflight, enters the current trip, then commits return intent before opening AR. */
    async open(onOpen: () => void, isCurrent: () => boolean, onStarted?: () => void): Promise<ArEntryResult> {
      if (pending) return 'busy';
      const route = arEntryRoute(deps.getSession());
      const current = () => isCurrent() && route !== undefined && arEntryRoute(deps.getSession()) === route;
      if (!current()) return 'cancelled';
      pending = true;
      deps.setPending(true);
      let entered = false;
      let startedGuidance = false;
      try {
        const supported = await deps.supported();
        if (!current()) return 'cancelled';
        if (!supported) return 'unsupported';
        const camera = await deps.requestCamera();
        if (!current()) return 'cancelled';
        if (!camera) return 'camera-denied';
        if (deps.getSession().phase === 'routeReady') {
          startedGuidance = deps.startGuidance();
          if (!startedGuidance) return 'cancelled';
        }
        if (!deps.enterAR()) return startedGuidance ? 'unavailable' : 'cancelled';
        entered = true;
        onStarted?.();
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
