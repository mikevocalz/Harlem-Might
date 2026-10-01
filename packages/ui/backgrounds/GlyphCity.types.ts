import type { ReactNode } from 'react';

export type GlyphCityVariant = 'downtown' | 'megacity' | 'district' | 'ruins';

export interface GlyphCityProps {
  className?: string;
  children?: ReactNode;
  variant?: GlyphCityVariant;
  colorPrimary?: string;
  colorSecondary?: string;
  colorTertiary?: string;
  backgroundColor?: string;
  speed?: number;
  showVehicles?: boolean;
  blinkingLights?: boolean;
  opacity?: number;
}
