import type { ReactNode } from 'react';

export interface ListProps {
  children?: ReactNode;
  /** Pull-to-refresh. Native only; the web fork ignores it. */
  onRefresh?: () => Promise<void>;
  className?: string;
}

export interface ListItemProps {
  children?: ReactNode;
  onPress?: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  supportingText?: string;
  className?: string;
}
