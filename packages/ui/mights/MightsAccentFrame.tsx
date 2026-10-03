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

export function MightsAccentFrame({ children, className = '', tone = 'iron' }: MightsAccentFrameProps) {
  return (
    <div className={`mights-frame relative ${toneClass[tone]} ${className}`}>
      {children}
    </div>
  );
}
