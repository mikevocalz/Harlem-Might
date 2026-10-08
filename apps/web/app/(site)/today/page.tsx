import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { harlemToday, listEventsForDate } from '@acme/payload/server';
import { MightsButton, MightsPage, routes } from '@acme/ui/mights';
import { TodayEvents } from '@/components/today/TodayEvents';
import { ContentNotice } from '@/components/content/ContentNotice';

export const metadata: Metadata = {
  title: 'Today',
  description: 'Events in Harlem today, each with its source and when it was last checked.',
};

const heading = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

async function TodayContent() {
  // Request-time date in Harlem's time zone; never baked in at build, never the server's UTC day.
  await connection();
  const now = new Date();
  const date = harlemToday(now);
  const parts = Object.fromEntries(heading.formatToParts(now).map((p) => [p.type, p.value]));
  const result = await listEventsForDate(date);

  let body: React.ReactNode;
  if (result.status === 'unavailable') {
    if (result.reason === 'query-failed') console.error('events read failed', date, result.error);
    body = (
      <ContentNotice
        title="We couldn’t check for events right now"
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
      <ContentNotice title="No events listed for today" actions={<MightsButton href={routes.explore()}>Open the map</MightsButton>}>
        Venue listings appear here once we’ve checked them. Start from a place on the map instead.
      </ContentNotice>
    );
  } else {
    body = <TodayEvents events={result.data} now={now} />;
  }

  return (
    <MightsPage
      title={`Today in Harlem, ${parts.weekday} ${parts.day} ${parts.month}`}
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
