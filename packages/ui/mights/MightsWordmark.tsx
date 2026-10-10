'use client';

import { Link } from 'solito/link';
import { Image } from '../Image';
import { routes } from './routes';

// The landscape logo (packages/assets/Harlem-Might-Logo-landscape.png, cropped
// and exported to apps/web/public/brand at 1x/2x/3x of a 48px-tall slot).
//
// The exports are already sized, so the loader maps next/image's candidate
// widths onto them instead of running the optimizer: for a fixed width it asks
// for the next size up from 1x (always under 2x), then from 2x and 3x.
const brandLoader = (slotWidth: number) => ({ width }: { width: number }) => {
  const file = width < slotWidth * 2 ? 48 : width < slotWidth * 3 ? 96 : 144;
  return `/brand/harlem-might-landscape-${file}.webp?w=${width}`;
};

export function MightsWordmark({ height = 40, className = '' }: { height?: number; className?: string }) {
  const width = Math.round((height * 2115) / 658);
  return (
    <Link href={routes.home()} aria-label="Harlem Might home" className={`mights-focus shrink-0 ${className}`}>
      <Image
        src="/brand/harlem-might-landscape-96.webp"
        loader={brandLoader(width)}
        alt="Harlem Might"
        width={width}
        height={height}
        loading="eager"
        // Stretch to the slot like a plain <img>; `contain` letterboxes the
        // 3.21:1 export into the 3.22:1 box and shifts it by a subpixel.
        contentFit="fill"
        style={{ display: 'block' }}
      />
    </Link>
  );
}
