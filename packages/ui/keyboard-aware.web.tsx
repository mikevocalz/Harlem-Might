'use client';
import { ScrollView } from './tw';

export interface KeyboardAwareScrollProps
  extends Omit<React.ComponentProps<typeof ScrollView>, 'onScroll'> {
  /** Native-only: extra room kept between the focused field and the keyboard. */
  bottomOffset?: number;
  /** Native-only: a Reanimated scroll handler, which is not a plain callback. */
  onScroll?: unknown;
  scrollEventThrottle?: number;
}

/**
 * Web has no software keyboard to avoid — the browser scrolls a focused field
 * into view itself — so this is a plain scroll view. `bottomOffset` is accepted
 * and ignored so screens can pass one prop set to both platforms.
 */
export function KeyboardAwareScroll({
  bottomOffset: _bottomOffset,
  onScroll: _onScroll,
  scrollEventThrottle: _throttle,
  ...props
}: KeyboardAwareScrollProps) {
  return <ScrollView {...props} />;
}
