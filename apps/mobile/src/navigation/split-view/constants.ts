/**
 * Android window size classes and the pane widths derived from them.
 *
 * Breakpoints are the Material 3 Adaptive / androidx.window width classes,
 * expressed in dp. `useWindowDimensions()` already reports dp on Android and
 * points on iOS, so no PixelRatio conversion belongs anywhere in this module.
 *
 * @see https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes
 */

/**
 * Lower bound (inclusive, dp) of each class. Ordered widest-first so that
 * resolution is a `find`, not a chain of comparisons.
 */
export const WINDOW_SIZE_CLASS_MIN_WIDTH_DP = {
  extraLarge: 1200,
  expanded: 840,
  medium: 600,
  compact: 0,
} as const;

export type WindowSizeClass = keyof typeof WINDOW_SIZE_CLASS_MIN_WIDTH_DP;

/** Widest-first, so the first match wins. */
export const WINDOW_SIZE_CLASSES_BY_WIDTH = [
  'extraLarge',
  'expanded',
  'medium',
  'compact',
] as const satisfies readonly WindowSizeClass[];

/**
 * Resolve a width in dp to its window size class.
 *
 * Lives here rather than beside the hook so it carries no `react-native`
 * import and stays directly testable.
 */
export function windowSizeClassForWidth(widthDp: number): WindowSizeClass {
  const match = WINDOW_SIZE_CLASSES_BY_WIDTH.find(
    (sizeClass) => widthDp >= WINDOW_SIZE_CLASS_MIN_WIDTH_DP[sizeClass],
  );
  // The last entry's lower bound is 0, so this only falls through for a
  // negative width, which RN never reports.
  return match ?? 'compact';
}

/**
 * Pane widths as Tailwind classes backed by --container-pane-* tokens
 * (packages/theme/tokens.ts). Fixed-width leading panes, flexible detail pane —
 * so only the leading panes and the inspector are sized here.
 */
export const PANE_WIDTH_CLASS = {
  primary: 'w-pane-primary',
  primaryNarrow: 'w-pane-primary-narrow',
  supplementary: 'w-pane-supplementary',
  inspector: 'w-pane-inspector',
} as const;

/**
 * Which panes are on screen at each size class, for both the 2-column
 * (primary + detail) and 3-column (primary + supplementary + detail) shapes.
 *
 * `inspector` is honoured only where it is `true`; below that it must occupy no
 * layout space at all rather than render zero-width.
 */
export interface PaneVisibility {
  readonly primary: boolean;
  readonly supplementary: boolean;
  readonly inspector: boolean;
  /** Primary uses the narrow token — the "rail" step before it disappears. */
  readonly primaryNarrow: boolean;
}

const VISIBILITY_TWO_COLUMN: Record<WindowSizeClass, PaneVisibility> = {
  extraLarge: { primary: true, supplementary: false, inspector: true, primaryNarrow: false },
  expanded: { primary: true, supplementary: false, inspector: true, primaryNarrow: false },
  medium: { primary: true, supplementary: false, inspector: false, primaryNarrow: true },
  compact: { primary: false, supplementary: false, inspector: false, primaryNarrow: false },
};

const VISIBILITY_THREE_COLUMN: Record<WindowSizeClass, PaneVisibility> = {
  extraLarge: { primary: true, supplementary: true, inspector: true, primaryNarrow: false },
  // Sidebar collapses to the narrow rail first, supplementary is kept because
  // it is the pane that actually drives the detail route.
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

/**
 * Leading-to-trailing order of the columns. Used to decide which way a pane
 * transition travels, so Back and forward navigation read as opposites.
 */
export const COLUMN_RANK = { primary: 0, supplementary: 1, secondary: 2 } as const;

/** Exactly one pane is visible at compact; every other class tiles. */
export function isCollapsed(sizeClass: WindowSizeClass): boolean {
  return sizeClass === 'compact';
}
