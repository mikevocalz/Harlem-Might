'use client';

import { Link } from 'solito/link';
import { routes } from './routes';
import { condensed } from './geometry';

// The wordmark is the type: Mona Sans, condensed end of wdth, weight 700.
export function MightsWordmark({ className = '' }: { className?: string }) {
  return (
    <Link
      href={routes.home()}
      aria-label="Harlem Mights home"
      className={`mights-focus font-sans text-[22px] font-bold leading-none tracking-[-0.01em] ${condensed} ${className}`}
    >
      Harlem Mights
    </Link>
  );
}
