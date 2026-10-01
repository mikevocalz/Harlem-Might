/**
 * Swipe-to-reveal maths.
 *
 * Pure so the thresholds can be tested without a gesture. `SwipeableRow` calls
 * these from Gesture Handler worklets.
 *
 * Prior art: `swipeable-view` in craftzdog/inkdrop-ui-mockup-react-native
 * (Apache-2.0). Reimplemented — see README.
 */

/** Fraction of the action width past which the row settles open. */
export const OPEN_THRESHOLD = 0.5;

/**
 * Fraction of the ROW width past which lifting the finger runs the action
 * outright instead of parking the row open. Deliberately far past the open
 * threshold: a full swipe is a decision, and it must not be reachable by
 * accident while someone is just peeking at what the actions are.
 */
export const COMMIT_THRESHOLD = 0.6;

/** Rubber-banding applied past the fully-open position. */
const RESISTANCE = 0.25;

export type SwipeSide = 'leading' | 'trailing';

/**
 * Clamp a raw drag into the row's travel.
 *
 * Travel is unrestricted up to the action width, then heavily resisted: the row
 * can still be pulled further, which is what makes a full-swipe commit feel
 * available, but it cannot be dragged off into space.
 */
export function swipeTranslation(
  raw: number,
  actionWidth: number,
  rowWidth: number,
  side: SwipeSide,
): number {
  'worklet';
  // Trailing actions live on the right, so the row travels negative.
  const directed = side === 'trailing' ? Math.min(raw, 0) : Math.max(raw, 0);
  const distance = Math.abs(directed);
  const sign = side === 'trailing' ? -1 : 1;

  if (distance <= actionWidth) return directed;

  const overshoot = distance - actionWidth;
  const resisted = actionWidth + overshoot * RESISTANCE;
  return sign * Math.min(resisted, rowWidth);
}

export type SwipeOutcome =
  /** Run the action; the row animates the rest of the way out. */
  | { kind: 'commit' }
  /** Park the row open so the actions can be tapped. */
  | { kind: 'open' }
  /** Snap shut. */
  | { kind: 'close' };

/**
 * What happens when the finger lifts.
 *
 * Velocity is considered before distance so a quick flick commits even though
 * it covered little ground — matching how every platform list behaves, and it
 * is what stops the gesture feeling sticky.
 */
export function resolveSwipe(params: {
  translation: number;
  velocity: number;
  actionWidth: number;
  rowWidth: number;
}): SwipeOutcome {
  'worklet';
  const { translation, velocity, actionWidth, rowWidth } = params;
  const distance = Math.abs(translation);

  if (distance >= rowWidth * COMMIT_THRESHOLD) return { kind: 'commit' };

  // A flick in the closing direction always closes, whatever the distance.
  const closing = translation === 0 || Math.sign(velocity) !== Math.sign(translation);
  if (closing && Math.abs(velocity) > 500) return { kind: 'close' };
  if (!closing && Math.abs(velocity) > 1200) return { kind: 'commit' };

  return distance >= actionWidth * OPEN_THRESHOLD ? { kind: 'open' } : { kind: 'close' };
}

/** Resting offset for an outcome. */
export function restingTranslation(
  outcome: SwipeOutcome,
  actionWidth: number,
  rowWidth: number,
  side: SwipeSide,
): number {
  'worklet';
  const sign = side === 'trailing' ? -1 : 1;
  switch (outcome.kind) {
    case 'commit':
      return sign * rowWidth;
    case 'open':
      return sign * actionWidth;
    case 'close':
      return 0;
  }
}
