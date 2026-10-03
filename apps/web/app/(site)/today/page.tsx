import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { MAPPED_PLACES } from '@acme/app/features/explore/explore.store.ts';
import { MightsBand, MightsButton, MightsPage, MightsPlaceBento, MightsText, routes } from '@acme/ui/mights';

export const metadata: Metadata = {
  title: 'Today',
  description: 'What is happening in Harlem today.',
};

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

async function TodayContent() {
  // Request-time date in Harlem's time zone; never baked in at build.
  await connection();
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return (
    <MightsPage title={`Today in Harlem, ${parts.weekday} ${parts.day} ${parts.month}`}>
      <MightsBand title="No events listed yet" action={<MightsButton href={routes.explore()}>Open the map</MightsButton>}>
        <MightsText>Event listings are on their way. In the meantime, these places are worth the trip today.</MightsText>
        <MightsPlaceBento places={MAPPED_PLACES.slice(0, 3)} />
      </MightsBand>
    </MightsPage>
  );
}

export default function TodayPage() {
  return (
    <Suspense>
      <TodayContent />
    </Suspense>
  );
}
