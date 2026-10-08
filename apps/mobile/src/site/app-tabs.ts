import { primaryNav } from '@acme/ui/mights';

/** The app's tabs, by the site path each one opens on. */
export type AppTabRoute = 'explore' | 'walks' | 'stories' | 'today' | 'more';

/**
 * The tab navigator's screen name for a tab: the file or folder under
 * `app/(tabs)/`. More is the `(more)` group so its pages keep site paths
 * (`/more`, `/ar`).
 */
export const TAB_SCREEN: Record<AppTabRoute, string> = {
  explore: 'explore',
  walks: 'walks',
  stories: 'stories',
  today: 'today',
  more: '(more)',
};

/**
 * The app's tabs, in order: the site's `primaryNav` (Explore, Walks, Stories,
 * Today) plus More, which holds what the site's dock puts in its More sheet.
 * Labels come from `primaryNav`, so the app and the site never drift.
 */
export const APP_TABS: readonly { route: AppTabRoute; label: string }[] = [
  ...primaryNav.map((item) => ({ route: item.href.slice(1) as AppTabRoute, label: item.label })),
  { route: 'more', label: 'More' },
];
