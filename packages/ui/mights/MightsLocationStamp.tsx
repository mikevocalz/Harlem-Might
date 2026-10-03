'use client';

import { Link } from 'solito/link';

// Replaces eyebrows. Sits on the image, names the real place shown, links to it.
export interface MightsLocationStampProps {
  name: string;
  street?: string;
  href?: string;
  tone?: 'light' | 'dark';
  className?: string;
}

export function MightsLocationStamp({ name, street, href, tone = 'light', className = '' }: MightsLocationStampProps) {
  const color =
    tone === 'dark'
      ? 'bg-mights-night/70 text-white'
      : 'bg-paper/90 text-text';
  const content = (
    <>
      <span aria-hidden className="h-2 w-2 shrink-0 rotate-45 bg-primary" />
      <span className="font-semibold">{name}</span>
      {street ? <span className="opacity-75">{street}</span> : null}
    </>
  );
  const cls = `inline-flex items-center gap-2 px-2.5 py-1 text-sm backdrop-blur-md ${color} ${className}`;
  return href ? (
    <Link href={href} className={`mights-focus ${cls} hover:underline`}>
      {content}
    </Link>
  ) : (
    <span className={cls}>{content}</span>
  );
}
