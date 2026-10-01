import {
  paneVisibility,
  type PaneVisibility,
  type WindowSizeClass,
} from './constants.ts';

/**
 * Panes a user can toggle by hand. `primaryNarrow` is derived, not toggled:
 * the primary pane's rail step is a consequence of width, not a separate
 * user-facing switch.
 */
export type TogglablePane = 'primary' | 'supplementary' | 'inspector';

/**
 * A manual override is scoped to ONE size class. The same override map covers
 * every class, so a user who hides the list on a tablet does not also hide it
 * on a phone, where it is the only thing on screen.
 *
 * Absent key = no override = the automatic policy decides.
 */
export type PaneOverrides = {
  readonly [S in WindowSizeClass]?: {
    readonly [P in TogglablePane]?: boolean;
  };
};

/**
 * Panes the size class can PHYSICALLY show, regardless of any override.
 *
 * This is the guard behind rule 5: a stale override must never make a pane
 * visible in a class that cannot fit it. Compact shows exactly one pane at a
 * time and the navigator owns which one, so nothing there is user-togglable;
 * medium has room for the primary rail beside the detail, but not for a third
 * column.
 */
function canShow(sizeClass: WindowSizeClass, pane: TogglablePane): boolean {
  if (sizeClass === 'compact') return false;
  if (sizeClass === 'medium') return pane === 'primary';
  return true;
}

/**
 * Resolve pane visibility from the automatic policy plus any manual override.
 *
 * Precedence, in order:
 *
 * 1. `paneVisibility(sizeClass, columnCount)` computes the default.
 * 2. An override recorded for THIS size class replaces that default.
 * 3. An override recorded for a DIFFERENT size class is ignored — crossing a
 *    breakpoint lands on the new class's own default unless it too has one.
 * 4. Persistence is the caller's business; this function is pure so it can be
 *    tested without a storage layer. See `usePaneOverrides` for where the map
 *    is stored.
 * 5. An override can never show a pane the class cannot fit (`canShow`). It
 *    CAN always hide one — hiding is safe at every width.
 *
 * `primaryNarrow` follows the resolved primary: a hidden pane is not narrow,
 * it is absent.
 */
export function resolvePaneVisibility(
  sizeClass: WindowSizeClass,
  columnCount: 1 | 2,
  overrides: PaneOverrides = {},
): PaneVisibility {
  const auto = paneVisibility(sizeClass, columnCount);
  const scoped = overrides[sizeClass];
  if (!scoped) return auto;

  const apply = (pane: TogglablePane): boolean => {
    const override = scoped[pane];
    if (override === undefined) return auto[pane];
    // Hiding is always honoured; showing is gated on what the class can fit.
    return override && !canShow(sizeClass, pane) ? auto[pane] : override;
  };

  const primary = apply('primary');
  return {
    primary,
    supplementary: apply('supplementary'),
    inspector: apply('inspector'),
    primaryNarrow: primary && auto.primaryNarrow,
  };
}

/**
 * Record a manual toggle for one pane in one size class.
 *
 * Returns a new map; the caller persists it. Toggling against the CURRENT
 * resolved value rather than the stored override means the first tap always
 * does what the button says, even when no override exists yet.
 */
export function togglePaneOverride(
  overrides: PaneOverrides,
  sizeClass: WindowSizeClass,
  pane: TogglablePane,
  currentlyVisible: boolean,
): PaneOverrides {
  return {
    ...overrides,
    [sizeClass]: { ...overrides[sizeClass], [pane]: !currentlyVisible },
  };
}

/**
 * Drop a size class's overrides, returning it to automatic behaviour. Backs
 * the "reset layout" affordance and keeps a user who has painted themselves
 * into a corner from having to reinstall.
 */
export function clearPaneOverrides(
  overrides: PaneOverrides,
  sizeClass: WindowSizeClass,
): PaneOverrides {
  const next = { ...overrides };
  delete next[sizeClass];
  return next;
}
