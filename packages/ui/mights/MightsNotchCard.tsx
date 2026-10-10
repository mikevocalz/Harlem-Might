'use client';

import { Link } from 'solito/link';
import { View } from '../tw';
import { notch } from './geometry';

// The ownable card shape: centred trapezoid notches top and bottom, a cut
// corner, a 2px rail, imagery bleeding to the edge, no drop shadow. Hover runs
// a gold beam along the rail (.mights-beam); it never lifts.
export interface MightsNotchCardProps {
  href?: string;
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  state?: 'rest' | 'live';
  /**
   * `inverted`: a gold fill with dark text, the primary button's pairing. Use
   * it to break a run of cards; text inside should use `text-on-primary`.
   * @default 'raised'
   */
  tone?: 'raised' | 'inverted';
  label?: string;
}

export function MightsNotchCard({
  href,
  children,
  className = '',
  innerClassName = '',
  state = 'rest',
  tone = 'raised',
  label,
}: MightsNotchCardProps) {
  const rail = state === 'live' ? 'bg-accent' : 'mights-beam';
  const body = (
    <View className={`relative flex h-full flex-col p-rail ${notch} ${rail} transition-colors duration-fast`}>
      <View
        className={`relative flex h-full flex-col overflow-hidden ${tone === 'inverted' ? 'bg-primary text-on-primary' : 'bg-surface-raised'} ${notch} ${innerClassName}`}
      >
        {children}
      </View>
    </View>
  );
  if (!href) return <View className={`group flex flex-col ${className}`}>{body}</View>;
  return (
    <Link href={href} aria-label={label} className={`mights-focus group flex flex-col ${className}`}>
      {body}
    </Link>
  );
}
