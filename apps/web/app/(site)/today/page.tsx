import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { getHarlemArchivalImage } from '@acme/app/content';
import { harlemToday } from '@acme/payload/server';
import { cachedEventsForDate } from '@/lib/cached-content';
import { MightsButton, MightsPage, routes } from '@acme/ui/mights';
import { TodayEvents } from '@acme/app/features/site/today/TodayEvents.tsx';
import { todayHeading } from '@acme/app/features/site/today/event-format.ts';
import { ContentNotice } from '@acme/app/features/site/content/ContentNotice.tsx';

const archiveImage = getHarlemArchivalImage('nypl-lenox-market-1939');

export const metadata: Metadata = {
  title: 'Today',
  description: 'Events in Harlem today, each with its source and when it was last checked.',
};

async function TodayContent() {
  // Request-time date in Harlem's time zone; never baked in at build, never the server's UTC day.
  await connection();
  const now = new Date();
  const date = harlemToday(now);
  // The date is the cache key, so each Harlem day is read once.
  const result = await cachedEventsForDate(date);

  let body: React.ReactNode;
  if (result.status === 'unavailable') {
    body = (
      <ContentNotice
        title="We couldn’t check for events right now"
        image={archiveImage}
        actions={
          <>
            <MightsButton href={routes.today()}>Try again</MightsButton>
            <MightsButton href={routes.explore()} variant="secondary">
              Open the map
            </MightsButton>
          </>
        }
      >
        Our records didn’t answer, so we can’t say what’s on today. Try again in a moment, or check the venue’s own site.
      </ContentNotice>
    );
  } else if (result.data.length === 0) {
    body = (
      <ContentNotice
        title="No events listed for today"
        image={archiveImage}
        actions={<MightsButton href={routes.explore()}>Open the map</MightsButton>}
      >
        Venue listings appear here once we’ve checked them. Start from a place on the map instead.
      </ContentNotice>
    );
  } else {
    body = <TodayEvents events={result.data} now={now} />;
  }

  return (
    <MightsPage
      title={`Today in Harlem, ${todayHeading(now)}`}
      lead="Events with a date and a source, and when we last checked each one."
    >
      {body}
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
