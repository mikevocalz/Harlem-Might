import type { ReactNode } from 'react';

export interface GridFloorProps {
  className?: string;
  children?: ReactNode;
  horizon?: number;
  columns?: number;
  rows?: number;
  lineColor?: string;
  backgroundColor?: string;
  glowColor?: string;
  speed?: number;
  opacity?: number;
  lineWidth?: number;
}
