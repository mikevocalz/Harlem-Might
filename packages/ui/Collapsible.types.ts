import type { ReactNode } from 'react';

export interface CollapsibleProps {
  label: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  children?: ReactNode;
  /**
   * Classes for the outer container. Native supports React Native box styling
   * through Uniwind (for example margin, padding, background and visibility).
   * Native header/body layout and label styling remain platform-owned; these
   * classes do not style the disclosure's internal native children.
   */
  className?: string;
}
