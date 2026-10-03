'use client';

import { Link } from 'solito/link';
import { notch } from './geometry';

// The ownable card shape: one notched corner, a 1px rail, photography (or a
// map) bleeding to the edge, no drop shadow. Hover is a rail-colour change,
// never a lift.
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
  const rail = state === 'live' ? 'bg-accent' : 'bg-rule-rail/80 group-hover:bg-primary';
  const body = (
    <span className={`relative flex h-full flex-col p-px ${notch} ${rail} transition-colors duration-[120ms]`}>
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
