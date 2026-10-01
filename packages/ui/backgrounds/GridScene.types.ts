import type { ReactNode } from 'react';

export interface GridSceneProps {
  className?: string;
  children?: ReactNode;
  horizon?: number;
  gap?: number;
  columns?: number;
  rows?: number;
  lineColor?: string;
  glowColor?: string;
  backgroundColor?: string;
  speed?: number;
  opacity?: number;
  lineWidth?: number;
  showCeiling?: boolean;
  showFloor?: boolean;
}
