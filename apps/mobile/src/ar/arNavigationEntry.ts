import type { NavigationController } from '@acme/app/features/navigation/session/navigationController.ts';

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
