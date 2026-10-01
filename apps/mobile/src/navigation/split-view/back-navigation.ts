import type { SplitNavigableColumn } from './types';

/**
 * The column Back should step to, or `null` when the leading column is already
 * showing and Back must fall through to the system.
 *
 * `columnCount` is the number of authored `SplitView.Column` children: 1 is the
 * two-pane shape (primary + detail), 2 is the three-pane shape
 * (primary + supplementary + detail). With one column there is no supplementary
 * pane to land on, so `secondary` steps straight to `primary`.
 */
export function previousColumn(
  current: SplitNavigableColumn,
  columnCount: 1 | 2,
): SplitNavigableColumn | null {
  switch (current) {
    case 'secondary':
      return columnCount === 2 ? 'supplementary' : 'primary';
    case 'supplementary':
      return 'primary';
    case 'primary':
      return null;
  }
}

export type BackOutcome =
  /** Let an earlier BackHandler subscription pop the detail stack. */
  | { kind: 'defer' }
  /** Step the collapsed split view to another column. */
  | { kind: 'step'; column: SplitNavigableColumn }
  /** Nothing left to do; the system should handle it. */
  | { kind: 'fallThrough' };

/**
 * Pure Back policy for the collapsed split view.
 *
 * Order is: pop within the detail pane's stack, then step back one column,
 * then fall through.
 *
 * DELIBERATE REFINEMENT: the pop is scoped to when the detail pane is the
 * visible one. Popping unconditionally would, while the sidebar is showing,
 * consume a Back press to mutate a stack the user cannot see — a press that
 * looks like it did nothing. Ordering is otherwise exactly as specified.
 */
export function resolveBack(params: {
  activeColumn: SplitNavigableColumn;
  columnCount: 1 | 2;
  canGoBack: boolean;
}): BackOutcome {
  const { activeColumn, columnCount, canGoBack } = params;

  if (activeColumn === 'secondary' && canGoBack) {
    return { kind: 'defer' };
  }

  const previous = previousColumn(activeColumn, columnCount);
  return previous === null ? { kind: 'fallThrough' } : { kind: 'step', column: previous };
}
