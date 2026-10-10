'use client';

import { Link } from 'solito/link';
import { Text } from '../html';
import { View } from '../tw';

// Replaces eyebrows. Sits on the image, names the real place shown, links to it.
export interface MightsLocationStampProps {
  name: string;
  street?: string;
  href?: string;
  tone?: 'light' | 'dark';
  className?: string;
  /**
   * `xr` sets the text at the Horizon secondary step (16/22), above Meta's
   * 14px floor; `sm` is the site's 14px stamp.
   * @default 'sm'
   */
  size?: 'sm' | 'xr';
}

export function MightsLocationStamp({ name, street, href, tone = 'light', className = '', size = 'sm' }: MightsLocationStampProps) {
  const color =
    tone === 'dark'
      ? 'bg-mights-night/70 text-white'
      : 'bg-paper/90 text-text';
  // The name and street are text nested in a text root, so they inherit the
  // stamp's colour, size and font instead of React Native Web's black 14px
  // default. `contents` keeps that root out of the flex layout.
  const content = (
    <>
      <View aria-hidden className="h-2 w-2 shrink-0 rotate-45 bg-primary" />
      <Text className="contents text-inherit [font:inherit] whitespace-normal">
        <Text className="font-semibold">{name}</Text>
        {street ? <Text className="opacity-75">{street}</Text> : null}
      </Text>
    </>
  );
  const textSize = size === 'xr' ? 'text-xr-label' : 'text-sm';
  const cls = `inline-flex items-center gap-2 px-2.5 py-1 ${textSize} backdrop-blur-md ${color} ${className}`;
  return href ? (
    <Link href={href} className={`mights-focus ${cls} hover:underline`}>
      {content}
    </Link>
  ) : (
    <View className={`flex-row ${cls}`}>{content}</View>
  );
}
