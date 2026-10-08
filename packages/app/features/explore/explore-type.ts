import { createContext, useContext } from 'react';

/**
 * Text classes for Explore. `xr` uses the absolute-dp `xr-*` steps from
 * `@acme/theme` (readable in a Horizon window at arm's length); `flat` keeps
 * the phone scale with a 12dp floor (design-system.md §2). Every step is a
 * token class; no `text-[Npx]` literals.
 */
export type ExploreTypeScale = 'flat' | 'xr';

const CLASSES = {
  flat: {
    caption: 'text-small',
    summary: 'text-label',
    paneTitle: 'text-title-lg md:text-title-lg xl:text-title-lg',
    label: 'text-body',
    body: 'text-body',
    title: 'text-lead',
    heading: 'text-title',
    prose: 'font-serif text-lead-sm',
  },
  xr: {
    caption: 'text-xr-caption',
    summary: 'text-xr-caption',
    paneTitle: 'text-xr-heading md:text-xr-heading xl:text-xr-heading',
    label: 'text-xr-label',
    body: 'text-xr-body',
    title: 'text-xr-title',
    heading: 'text-xr-heading',
    prose: 'font-serif text-xr-prose',
  },
} as const satisfies Record<ExploreTypeScale, Record<string, string>>;

export type ExploreTypeClasses = (typeof CLASSES)[ExploreTypeScale];

/** Which scale Explore renders with. The mobile layout provides `xr` on quest builds. */
export const ExploreTypeContext = createContext<ExploreTypeScale>('flat');

/** The type classes for the current {@linkcode ExploreTypeContext}. */
export function useExploreType(): ExploreTypeClasses {
  return CLASSES[useContext(ExploreTypeContext)];
}
