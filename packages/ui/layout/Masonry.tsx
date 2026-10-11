import type { ReactNode } from 'react';
import { List } from '../html';

/** Preserve each photograph's height in the editorial feed. */
export function Masonry({ children }: { children: ReactNode }) {
  return <List className="mx-auto flex w-full flex-col gap-4 md:block md:columns-2 md:gap-4 lg:columns-3">{children}</List>;
}
