/** Keep cards readable within the 896dp editorial container, not the physical screen. */
export function masonryColumnCount(width: number): number {
  return width >= 820 ? 3 : width >= 560 ? 2 : 1;
}
