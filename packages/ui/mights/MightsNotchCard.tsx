'use client';

import { Link } from 'solito/link';
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
  label?: string;
}

export function MightsNotchCard({
  href,
  children,
  className = '',
  innerClassName = '',
  state = 'rest',
  label,
}: MightsNotchCardProps) {
  const rail = state === 'live' ? 'bg-accent' : 'mights-beam';
  const body = (
    <span className={`relative flex h-full flex-col p-rail ${notch} ${rail} transition-colors duration-fast`}>
      <span className={`relative flex h-full flex-col overflow-hidden bg-surface-raised ${notch} ${innerClassName}`}>
        {children}
      </span>
    </span>
  );
  if (!href) return <div className={`group flex flex-col ${className}`}>{body}</div>;
  return (
    <Link href={href} aria-label={label} className={`mights-focus group flex flex-col ${className}`}>
      {body}
    </Link>
  );
}
