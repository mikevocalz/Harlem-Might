import type { ReactNode } from 'react';

export interface FieldGroupProps {
  children?: ReactNode;
}

export interface FieldSectionProps {
  children?: ReactNode;
  /** Section heading, rendered in the platform's own grouped-list style. */
  title?: string;
  titleUppercase?: boolean;
}
