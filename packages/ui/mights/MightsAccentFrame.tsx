import { View } from '../tw';

// Four corner marks. Focus, the selected pin, the Sightline lens, the QR card —
// never a card decoration.
export interface MightsAccentFrameProps {
  children: React.ReactNode;
  className?: string;
  tone?: 'iron' | 'cobalt' | 'live';
}

const toneClass = {
  iron: '[--frame:var(--color-rule-rail)]',
  cobalt: '[--frame:var(--color-primary)]',
  live: '[--frame:var(--color-accent)]',
} as const;

// `block` keeps the old <div> flow; a kit View is a flex column by default.
export function MightsAccentFrame({ children, className = '', tone = 'iron' }: MightsAccentFrameProps) {
  return <View className={`mights-frame relative block ${toneClass[tone]} ${className}`}>{children}</View>;
}
