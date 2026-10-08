import type { AppTabRoute } from './app-tabs';

// Every tab route, checked against `AppTabRoute` at compile time so a new tab
// cannot be left out of the visibility rules.
const ALL_TABS: Record<AppTabRoute, true> = {
  explore: true,
  walks: true,
  stories: true,
  today: true,
  more: true,
};

/**
 * Tabs struck from the navigation on Horizon (quest) builds.
 *
 * More: STRUCK on Horizon builds, 2026-10-08 (DECISIONS S20). Condition:
 * `isHorizonBuild`. On a headset the rail is its own spatial window, and More
 * only reopened its list in the main window, so it added a hop without adding
 * a place. Phone, tablet, web and PICO keep More. The `(more)` routes stay
 * registered on every build, so `/more` and `/ar` still resolve from deep
 * links. Lift the strike if More gains content that belongs in its own panel.
 */
export const HORIZON_STRUCK_TABS: ReadonlySet<AppTabRoute> = new Set<AppTabRoute>(['more']);

/** Whether the tab bar or rail draws a button for `route`. */
export function isTabShown(route: AppTabRoute, horizon: boolean): boolean {
  return !(horizon && HORIZON_STRUCK_TABS.has(route));
}

/** The number of tabs the Horizon rail draws. Sizes the rail window. */
export const HORIZON_TAB_COUNT: number = (Object.keys(ALL_TABS) as AppTabRoute[]).filter((route) =>
  isTabShown(route, true),
).length;
