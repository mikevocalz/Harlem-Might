'use client';
import { useState } from 'react';
import { Text, View } from '../tw';
import type { MightsLocationStampProps } from './MightsLocationStamp';
import { PressableLink } from './MightsShape.native';

// Native fork of MightsLocationStamp.tsx: same props. The web's backdrop blur
// is dropped (the /90 and /70 fills carry the contrast on their own); the
// hover underline becomes a pressed underline.

/** Names the real place in an image and, with `href`, links to it. */
export function MightsLocationStamp({ name, street, href, tone = 'light', className = '' }: MightsLocationStampProps) {
  const surface = tone === 'dark' ? 'bg-mights-night/70' : 'bg-paper/90';
  const ink = tone === 'dark' ? 'text-white' : 'text-text';
  const row = `flex-row items-center gap-2 self-start px-2.5 py-1 ${surface} ${className}`;

  const content = (underline: boolean) => (
    <>
      <View aria-hidden className="h-2 w-2 shrink-0 rotate-45 bg-primary" />
      <Text className={`font-sans-semibold text-sm ${ink} ${underline ? 'underline' : ''}`}>{name}</Text>
      {street ? <Text className={`font-sans text-sm opacity-75 ${ink}`}>{street}</Text> : null}
    </>
  );

  if (!href) return <View className={row}>{content(false)}</View>;
  return <StampLink href={href} className={row} label={street ? `${name}, ${street}` : name} render={content} />;
}

function StampLink({
  href,
  className,
  label,
  render,
}: {
  href: string;
  className: string;
  label: string;
  render: (underline: boolean) => React.ReactNode;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <PressableLink
      href={href}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityLabel={label}
      // The stamp is ~28dp tall; the slop brings the touch target to 48dp.
      hitSlop={{ top: 10, bottom: 10 }}
      className={className}
    >
      {render(pressed)}
    </PressableLink>
  );
}
