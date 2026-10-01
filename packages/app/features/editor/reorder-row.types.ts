import type { ReactNode } from 'react';

export interface ReorderRowProps {
  /** The row's content, to the right of the handle. */
  children: ReactNode;
  /** Names the handle for assistive tech — "Reorder Bold". */
  label: string;
  index: number;
  count: number;
  /** Row pitch in dp, which is also the distance of one index step. */
  rowHeight: number;
  onMove: (from: number, to: number) => void;
  /**
   * The scrolling ancestor. The drag must BLOCK it once it activates, or the
   * scroll view claims every vertical movement and the row never follows the
   * finger. Native only; the web fork has no competing gesture.
   */
  scrollRef?: React.RefObject<unknown>;
}
