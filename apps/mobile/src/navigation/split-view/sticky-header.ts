/**
 * Auto-hiding header maths.
 *
 * Pure so the behaviour can be tested without a scroll view or a UI thread.
 * `use-sticky-header.ts` calls these from a Reanimated worklet.
 *
 * Prior art: the `use-sticky-header` hook in craftzdog/inkdrop-ui-mockup-react-native
 * (Apache-2.0). Reimplemented, not copied — see README.
 */

/** Header fully visible. */
export const SHOWN = 0;

/**
 * How far from the top the header is forced open regardless of direction, in
 * dp. Without this, a list that is already near the top can be left with the
 * header half-hidden and no obvious way to bring it back.
 */
export const NEAR_TOP_THRESHOLD = 8;

/**
 * Next header offset for a scroll delta.
 *
 * Tracks the DELTA from the previous scroll position rather than the absolute
 * offset. Absolute offset ties the header's position to how far the list has
 * scrolled, so a fast fling rips it away in one frame and reversing direction
 * does nothing until you scroll back past the original anchor. A delta lets the
 * header start coming back the moment the finger reverses, which is what makes
 * it feel attached to the gesture.
 *
 * Scrolling DOWN (positive delta) hides; scrolling UP reveals.
 */
export function nextHeaderOffset(current: number, delta: number, headerHeight: number): number {
  'worklet';
  const next = current - delta;
  if (next < -headerHeight) return -headerHeight;
  if (next > SHOWN) return SHOWN;
  return next;
}

/**
 * How hidden the header is, 0 (shown) to 1 (fully retracted). Drives opacity or
 * any other derived value without a second source of truth.
 */
export function headerProgress(offset: number, headerHeight: number): number {
  'worklet';
  if (headerHeight <= 0) return 0;
  const progress = -offset / headerHeight;
  if (progress <= 0) return 0;
  if (progress > 1) return 1;
  return progress;
}

/**
 * Where the header settles when the finger lifts: never part-way.
 *
 * Past the halfway point it commits to hidden, otherwise it returns. Near the
 * top of the list it always returns, because a header stuck off-screen at
 * offset 0 looks like a rendering bug.
 */
export function snapHeaderOffset(
  offset: number,
  headerHeight: number,
  scrollOffset: number,
): number {
  'worklet';
  if (scrollOffset <= NEAR_TOP_THRESHOLD) return SHOWN;
  return headerProgress(offset, headerHeight) > 0.5 ? -headerHeight : SHOWN;
}
