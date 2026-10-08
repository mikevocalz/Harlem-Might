'use no memo';
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetCard, WidgetKind } from '@acme/widgets';
import { toMobileDeepLink } from '@acme/widgets';

const FALLBACK: Record<WidgetKind, { eyebrow: string; title: string; subtitle: string; uri: string }> = {
  story: { eyebrow: 'THIS IS HARLEM', title: 'Explore Harlem', subtitle: 'Discover the stories of the neighborhood', uri: 'harlemmight://stories' },
  event: { eyebrow: 'HAPPENING IN HARLEM', title: 'Explore today', subtitle: 'Find a verified neighborhood event', uri: 'harlemmight://today' },
  place: { eyebrow: 'MY HARLEM', title: 'My places', subtitle: 'Save a place to keep it close', uri: 'harlemmight://explore' },
  walk: { eyebrow: 'TAKE ME THERE', title: 'Start a Harlem walk', subtitle: 'Explore on foot, your way', uri: 'harlemmight://walks' },
};

export function HarlemWidget({ kind, card }: { kind: WidgetKind; card: WidgetCard | null }) {
  const fallback = FALLBACK[kind];
  const eyebrow = card?.eyebrow ?? fallback.eyebrow;
  const title = card?.title ?? fallback.title;
  const subtitle = card?.subtitle ?? fallback.subtitle;
  const uri = card ? toMobileDeepLink(card.path) : fallback.uri;
  return (
    <FlexWidget
      style={{
        height: 'match_parent', width: 'match_parent', padding: 18,
        backgroundColor: '#0B0906', borderRadius: 20,
        justifyContent: 'space-between',
      }}
      accessibilityLabel={`${eyebrow}: ${title}. ${subtitle}. Open Harlem Might.`}
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
    >
      <TextWidget text={eyebrow} style={{ fontSize: 11, color: '#F8C626', fontWeight: 'bold' }} />
      <TextWidget text={title} style={{ fontSize: 20, color: '#F4EEE0', fontWeight: 'bold' }} />
      <TextWidget text={subtitle} style={{ fontSize: 12, color: '#C9BDA0' }} />
    </FlexWidget>
  );
}
