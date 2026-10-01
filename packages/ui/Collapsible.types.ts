import type { ReactNode } from 'react';

export interface CollapsibleProps {
  label: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  children?: ReactNode;
  className?: string;
}
