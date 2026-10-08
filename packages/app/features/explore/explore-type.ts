import { createContext, useContext } from 'react';

/**
 * Text, spacing and control sizes for Explore. `xr` uses the absolute-dp
 * `xr-*` steps and Horizon spacing from `@acme/theme` (readable in a Horizon
 * window at arm's length, DECISIONS S17); `flat` keeps the phone scale with a
 * 12dp floor (design-system.md §2). Every step is a token class; no
 * `text-[Npx]` literals.
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
    /** Secondary lines: list meta, addresses, distances. */
    meta: 'text-small',
    /** Between sections of a pane. */
    sectionGap: 'gap-5',
    sectionTop: 'pt-5',
    /** Between stacked items inside a section. */
    stackGap: 'gap-3',
    /** Between controls on one line. */
    inlineGap: 'gap-2',
    /** A Discover result row. */
    row: 'min-h-target py-4',
    /** The search field. */
    search: 'h-12',
    /** Detail's header strip. */
    header: 'py-4',
  },
  xr: {
    caption: 'text-xr-caption',
    summary: 'text-xr-label',
    paneTitle: 'text-xr-heading md:text-xr-heading xl:text-xr-heading',
    label: 'text-xr-label',
    body: 'text-xr-body',
    title: 'text-xr-title',
    heading: 'text-xr-headline',
    prose: 'font-serif text-xr-prose',
    meta: 'text-xr-label',
    sectionGap: 'gap-xr-section',
    sectionTop: 'pt-xr-section',
    stackGap: 'gap-xr-stack',
    inlineGap: 'gap-xr-inline',
    row: 'min-h-xr-row py-xr-stack',
    search: 'h-target-primary',
    header: 'min-h-xr-header py-xr-inline',
  },
} as const satisfies Record<ExploreTypeScale, Record<string, string>>;

/**
 * Button sizes per scale: `control` for every action, `primary` for the
 * actions Meta asks to be 60dp on Horizon (Close, Get directions, Open place
 * page, Search).
 */
const BUTTONS = {
  flat: { control: 'sm', primary: 'sm', stamp: 'sm' },
  xr: { control: 'xr', primary: 'xr-primary', stamp: 'xr' },
} as const;

export type ExploreTypeClasses = (typeof CLASSES)[ExploreTypeScale] & {
  buttons: (typeof BUTTONS)[ExploreTypeScale];
};

/** Which scale Explore renders with. The mobile layout provides `xr` on quest builds. */
export const ExploreTypeContext = createContext<ExploreTypeScale>('flat');

const RESOLVED: Record<ExploreTypeScale, ExploreTypeClasses> = {
  flat: { ...CLASSES.flat, buttons: BUTTONS.flat },
  xr: { ...CLASSES.xr, buttons: BUTTONS.xr },
};

/** The classes and control sizes for the current {@linkcode ExploreTypeContext}. */
export function useExploreType(): ExploreTypeClasses {
  return RESOLVED[useContext(ExploreTypeContext)];
}
