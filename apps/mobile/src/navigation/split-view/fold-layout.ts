export type FoldOrientation = 'vertical' | 'horizontal';
export type FoldPosture = 'flat' | 'book' | 'tabletop';

export interface FoldLayout {
  orientation: FoldOrientation;
  posture: FoldPosture;
  separating: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewportSegmentLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

const EPSILON = 1;

const right = (segment: ViewportSegmentLike) => segment.x + segment.width;
const bottom = (segment: ViewportSegmentLike) => segment.y + segment.height;

const roughlyEqual = (a: number, b: number) => Math.abs(a - b) <= EPSILON;

/**
 * Translate the browser Viewport Segments API into the same hinge geometry the
 * native SplitView planner consumes.
 *
 * Multi-segment devices are preserved: 3 horizontal segments -> 2 vertical
 * folds, so a trifold is not collapsed to "hinge #1".
 */
export function foldsFromViewportSegments(
  input: readonly ViewportSegmentLike[],
  posture: 'continuous' | 'folded' = 'continuous',
): FoldLayout[] {
  if (input.length < 2) return [];

  const segments = [...input];
  const sideBySide = segments.every(
    (segment) =>
      roughlyEqual(segment.y, segments[0]!.y) &&
      roughlyEqual(segment.height, segments[0]!.height),
  );
  const stacked = segments.every(
    (segment) =>
      roughlyEqual(segment.x, segments[0]!.x) &&
      roughlyEqual(segment.width, segments[0]!.width),
  );

  if (sideBySide) {
    segments.sort((a, b) => a.x - b.x);
    return segments.slice(0, -1).map((segment, index) => {
      const next = segments[index + 1]!;
      const start = right(segment);
      return {
        orientation: 'vertical' as const,
        posture: posture === 'folded' ? ('book' as const) : ('flat' as const),
        separating: true,
        x: start,
        y: Math.min(segment.y, next.y),
        width: Math.max(0, next.x - start),
        height: Math.max(bottom(segment), bottom(next)) - Math.min(segment.y, next.y),
      };
    });
  }

  if (stacked) {
    segments.sort((a, b) => a.y - b.y);
    return segments.slice(0, -1).map((segment, index) => {
      const next = segments[index + 1]!;
      const start = bottom(segment);
      return {
        orientation: 'horizontal' as const,
        posture: posture === 'folded' ? ('tabletop' as const) : ('flat' as const),
        separating: true,
        x: Math.min(segment.x, next.x),
        y: start,
        width: Math.max(right(segment), right(next)) - Math.min(segment.x, next.x),
        height: Math.max(0, next.y - start),
      };
    });
  }

  // Mixed / irregular segment geometry is intentionally not guessed. Width
  // classes still provide a safe responsive layout.
  return [];
}

export interface VerticalFoldPanePlan {
  splitAfter: 'primary' | 'supplementary';
  primaryWidth: number;
  supplementaryWidth: number;
  gapWidth: number;
}

export function resolveVerticalFoldPanePlan(input: {
  fold: FoldLayout | null;
  rowWidth: number;
  primaryVisible: boolean;
  supplementaryVisible: boolean;
  detailVisible: boolean;
  primaryWidth: number;
  supplementaryWidth: number;
  detailMinWidth: number;
  paneMinWidth: number;
}): VerticalFoldPanePlan | null {
  const {
    fold,
    rowWidth,
    primaryVisible,
    supplementaryVisible,
    detailVisible,
    primaryWidth,
    supplementaryWidth,
    detailMinWidth,
    paneMinWidth,
  } = input;

  if (!fold || !fold.separating || fold.orientation !== 'vertical' || !detailVisible) {
    return null;
  }

  const gapWidth = Math.min(fold.width, Math.max(0, rowWidth - fold.x));
  const leadingWidth = Math.min(Math.max(0, fold.x), rowWidth);
  const trailingWidth = Math.max(0, rowWidth - leadingWidth - gapWidth);

  if (leadingWidth < paneMinWidth || trailingWidth < detailMinWidth) return null;

  if (supplementaryVisible) {
    const primaryOnLeading = primaryVisible ? primaryWidth : 0;
    const supplementaryOnLeading = leadingWidth - primaryOnLeading;

    if (
      supplementaryOnLeading >= paneMinWidth &&
      (!primaryVisible || primaryOnLeading >= paneMinWidth)
    ) {
      return {
        splitAfter: 'supplementary',
        primaryWidth,
        supplementaryWidth: supplementaryOnLeading,
        gapWidth,
      };
    }

    if (primaryVisible && trailingWidth >= paneMinWidth + detailMinWidth) {
      return {
        splitAfter: 'primary',
        primaryWidth: leadingWidth,
        supplementaryWidth: Math.max(
          paneMinWidth,
          Math.min(supplementaryWidth, trailingWidth - detailMinWidth),
        ),
        gapWidth,
      };
    }

    return null;
  }

  if (!primaryVisible) return null;

  return {
    splitAfter: 'primary',
    primaryWidth: leadingWidth,
    supplementaryWidth,
    gapWidth,
  };
}

export interface VerticalMultiFoldPanePlan {
  primaryWidth: number;
  supplementaryWidth: number;
  gapAfterPrimary: number;
  gapAfterSupplementary: number;
}

export function resolveVerticalMultiFoldPanePlan(input: {
  folds: readonly FoldLayout[];
  rowWidth: number;
  primaryVisible: boolean;
  supplementaryVisible: boolean;
  detailVisible: boolean;
  primaryWidth: number;
  supplementaryWidth: number;
  detailMinWidth: number;
  paneMinWidth: number;
}): VerticalMultiFoldPanePlan | null {
  const {
    folds,
    rowWidth,
    primaryVisible,
    supplementaryVisible,
    detailVisible,
    primaryWidth,
    supplementaryWidth,
    detailMinWidth,
    paneMinWidth,
  } = input;

  if (!primaryVisible || !supplementaryVisible || !detailVisible) return null;

  const vertical = folds
    .filter(
      (fold) =>
        fold.separating &&
        fold.orientation === 'vertical' &&
        fold.x > 0 &&
        fold.x < rowWidth,
    )
    .sort((a, b) => a.x - b.x);

  if (vertical.length < 2) return null;

  let best:
    | (VerticalMultiFoldPanePlan & { score: number })
    | null = null;

  for (let firstIndex = 0; firstIndex < vertical.length - 1; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < vertical.length; secondIndex += 1) {
      const first = vertical[firstIndex]!;
      const second = vertical[secondIndex]!;

      const firstStart = Math.max(0, Math.min(rowWidth, first.x));
      const firstEnd = Math.max(firstStart, Math.min(rowWidth, first.x + first.width));
      const secondStart = Math.max(firstEnd, Math.min(rowWidth, second.x));
      const secondEnd = Math.max(secondStart, Math.min(rowWidth, second.x + second.width));

      const firstRegion = firstStart;
      const secondRegion = secondStart - firstEnd;
      const thirdRegion = rowWidth - secondEnd;

      if (
        firstRegion < paneMinWidth ||
        secondRegion < paneMinWidth ||
        thirdRegion < detailMinWidth
      ) {
        continue;
      }

      const score =
        Math.abs(firstRegion - primaryWidth) +
        Math.abs(secondRegion - supplementaryWidth);

      if (!best || score < best.score) {
        best = {
          primaryWidth: firstRegion,
          supplementaryWidth: secondRegion,
          gapAfterPrimary: firstEnd - firstStart,
          gapAfterSupplementary: secondEnd - secondStart,
          score,
        };
      }
    }
  }

  if (!best) return null;
  return {
    primaryWidth: best.primaryWidth,
    supplementaryWidth: best.supplementaryWidth,
    gapAfterPrimary: best.gapAfterPrimary,
    gapAfterSupplementary: best.gapAfterSupplementary,
  };
}

export function resolveTrailingInspectorLayout(input: {
  folds: readonly FoldLayout[];
  rowWidth: number;
  preferredWidth: number;
  isRTL: boolean;
}) {
  const { folds, rowWidth, preferredWidth, isRTL } = input;
  const edge: 'left' | 'right' = isRTL ? 'left' : 'right';
  let availableWidth = rowWidth;

  const vertical = folds
    .filter((fold) => fold.separating && fold.orientation === 'vertical')
    .sort((a, b) => a.x - b.x);

  if (vertical.length > 0) {
    if (isRTL) {
      availableWidth = Math.min(Math.max(0, vertical[0]!.x), rowWidth);
    } else {
      const last = vertical[vertical.length - 1]!;
      availableWidth = Math.max(0, rowWidth - Math.min(rowWidth, last.x + last.width));
    }
  }

  const width = Math.max(0, Math.min(preferredWidth, availableWidth));
  const travel = width + 20;

  return {
    width,
    edge,
    closedX: isRTL ? -travel : travel,
  };
}
