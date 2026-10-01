import type { ReactNode } from 'react';

export interface MenuAction {
  id: string;
  title: string;
  /** Rendered in red and, on iOS, flagged to the system as destructive. */
  destructive?: boolean;
  disabled?: boolean;
}

export interface MenuProps {
  /** The control the menu is anchored to. */
  children: ReactNode;
  actions: readonly MenuAction[];
  onAction: (id: string) => void;
  /** Heading shown at the top of the menu. */
  title?: string;
  className?: string;
}
