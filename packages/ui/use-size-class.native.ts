'use client';
import { useWindowDimensions } from 'react-native';
import { REGULAR_MIN_WIDTH, type SizeClass } from './size-class.constants';

export type { SizeClass };
export { REGULAR_MIN_WIDTH };

/**
 * Native has real dimensions from the first render — there is no server pass —
 * so the window width is read directly.
 */
export function useSizeClass(): SizeClass {
  const { width } = useWindowDimensions();
  return width >= REGULAR_MIN_WIDTH ? 'regular' : 'compact';
}
