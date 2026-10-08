/**
 * Adaptive window-size classes for the SplitView fallback.
 *
 * These are the Material 3 width bands used by the Moyo foldable work:
 * compact <600, medium 600–839, expanded 840–1199, large 1200–1599,
 * extraLarge >=1600.
 *
 * useWindowDimensions() reports dp/points on native and CSS px on web.
 * The values live in `@acme/theme` (`windowClass`) so the theme owns them.
 */
import { windowClass } from '@acme/theme';

export const WINDOW_SIZE_CLASS_MIN_WIDTH_DP = windowClass;

export type WindowSizeClass = keyof typeof WINDOW_SIZE_CLASS_MIN_WIDTH_DP;

export const WINDOW_SIZE_CLASSES_BY_WIDTH = [
  'extraLarge',
  'large',
  'expanded',
  'medium',
  'compact',
] as const satisfies readonly WindowSizeClass[];

export function windowSizeClassForWidth(widthDp: number): WindowSizeClass {
  const match = WINDOW_SIZE_CLASSES_BY_WIDTH.find(
    (sizeClass) => widthDp >= WINDOW_SIZE_CLASS_MIN_WIDTH_DP[sizeClass],
  );
  return match ?? 'compact';
}

export const PANE_WIDTH_CLASS = {
  primary: 'w-pane-primary',
  primaryNarrow: 'w-pane-primary-narrow',
  supplementary: 'w-pane-supplementary',
  inspector: 'w-pane-inspector',
} as const;

export interface PaneVisibility {
  readonly primary: boolean;
  readonly supplementary: boolean;
  readonly inspector: boolean;
  readonly primaryNarrow: boolean;
}

const VISIBILITY_TWO_COLUMN: Record<WindowSizeClass, PaneVisibility> = {
  extraLarge: { primary: true, supplementary: false, inspector: true, primaryNarrow: false },
  large: { primary: true, supplementary: false, inspector: true, primaryNarrow: false },
  expanded: { primary: true, supplementary: false, inspector: true, primaryNarrow: false },
  medium: { primary: true, supplementary: false, inspector: false, primaryNarrow: true },
  compact: { primary: false, supplementary: false, inspector: false, primaryNarrow: false },
};

const VISIBILITY_THREE_COLUMN: Record<WindowSizeClass, PaneVisibility> = {
  extraLarge: { primary: true, supplementary: true, inspector: true, primaryNarrow: false },
  large: { primary: true, supplementary: true, inspector: true, primaryNarrow: false },
  expanded: { primary: true, supplementary: true, inspector: false, primaryNarrow: true },
  medium: { primary: false, supplementary: true, inspector: false, primaryNarrow: false },
  compact: { primary: false, supplementary: false, inspector: false, primaryNarrow: false },
};

export function paneVisibility(
  sizeClass: WindowSizeClass,
  columnCount: 1 | 2,
): PaneVisibility {
  return columnCount === 2
    ? VISIBILITY_THREE_COLUMN[sizeClass]
    : VISIBILITY_TWO_COLUMN[sizeClass];
}

export const COLUMN_RANK = { primary: 0, supplementary: 1, secondary: 2 } as const;

export function isCollapsed(sizeClass: WindowSizeClass): boolean {
  return sizeClass === 'compact';
}
