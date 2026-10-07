'use client';

import { Link } from 'solito/link';
import { routes } from './routes';

// The landscape logo (packages/assets/Harlem-Might-Logo-landscape.png, cropped
// and exported to apps/web/public/brand at 1x/2x/3x of a 48px-tall slot).
export function MightsWordmark({ height = 40, className = '' }: { height?: number; className?: string }) {
  const width = Math.round((height * 2115) / 658);
  return (
    <Link href={routes.home()} aria-label="Harlem Might home" className={`mights-focus shrink-0 ${className}`}>
      {/* Plain <img>: this package lints outside the Next plugin; static brand asset with sized srcset */}
      <img
        src="/brand/harlem-might-landscape-96.webp"
        srcSet="/brand/harlem-might-landscape-48.webp 1x, /brand/harlem-might-landscape-96.webp 2x, /brand/harlem-might-landscape-144.webp 3x"
        alt="Harlem Might"
        width={width}
        height={height}
        className="block"
      />
    </Link>
  );
}
