import { EVENTS_PAGE_SIZE, getHarlemArchivalImage, type EventPage } from '@acme/app/content';
import { MightsButton, MightsPage, MightsText, routes } from '@acme/ui/mights';
import { Nav } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { ContentNotice } from '../content/ContentNotice.tsx';
import type { ScreenResult } from '../stories/StoriesScreen.tsx';
import { HistoryFact } from './HistoryFact.tsx';
import { TodayEvents } from './TodayEvents.tsx';
import { eventRangeLabel, todayHeading } from './event-format.ts';
import { eventDateRange, type EventSearch } from './event-query.ts';
import { ContentLoader } from '@acme/app/features/site/content/ContentLoader.tsx';

const archiveImage = getHarlemArchivalImage('nypl-lenox-market-1939');

/** Shared Today/Upcoming content, within the existing page and navigation shell. */
export function TodayScreen({ date, now, result, view = 'today', page = 1, retryAction }: {
  date: string;
  now: Date;
  result: ScreenResult<EventPage> | undefined;
  view?: EventSearch['view'];
  page?: number;
  retryAction?: React.ReactNode;
}) {
  const upcoming = view === 'upcoming';
  const range = eventDateRange(date, view);
  const when = upcoming ? 'in this date range' : 'today';
  let body;
  if (!result) body = <ContentLoader label={`Checking for events ${when}`} />;
  else if (result.status === 'unavailable') {
    body = (
      <ContentNotice title="We couldn’t check for events right now" image={archiveImage} actions={
        <>
          {retryAction ?? <MightsButton href={routes.today({ view, page })}>Try again</MightsButton>}
          <MightsButton href={routes.explore()} variant="secondary">Open the map</MightsButton>
        </>
      }>
        Our records didn’t answer, so we can’t say what’s on {when}. Try again in a moment, or check the venue’s own site.
      </ContentNotice>
    );
  } else if (result.data.events.length === 0) {
    body = (
      <ContentNotice
        title={page > 1 ? 'No events on this page' : `No events listed ${upcoming ? 'in this date range' : 'for today'}`}
        image={archiveImage}
        actions={page > 1 ? (
          <MightsButton href={routes.today({ view })}>First page</MightsButton>
        ) : upcoming ? (
          <MightsButton href={routes.explore()}>Open the map</MightsButton>
        ) : (
          <MightsButton href={routes.today({ view: 'upcoming' })}>See upcoming events</MightsButton>
        )}
      >
        {page > 1 ? 'Listings may have changed. Return to the first page for the latest events.' :
          'Venue listings appear here once we’ve checked them. Check another date range or explore places on the map.'}
      </ContentNotice>
    );
  } else body = (
    <View className="gap-8">
      <MightsText size="small">
        Showing {(page - 1) * EVENTS_PAGE_SIZE + 1}–{(page - 1) * EVENTS_PAGE_SIZE + result.data.events.length} of {result.data.totalDocs} listings.
      </MightsText>
      <TodayEvents events={result.data.events} now={now} showDate={upcoming} />
      {(page > 1 || result.data.hasNextPage) ? (
        <Nav aria-label="Event pages" className="flex flex-row flex-wrap items-center gap-3">
          {page > 1 ? <MightsButton href={routes.today({ view, page: page - 1 })} variant="secondary">Previous page</MightsButton> : null}
          <MightsText size="small">Page {page}</MightsText>
          {result.data.hasNextPage ? <MightsButton href={routes.today({ view, page: page + 1 })}>Next page</MightsButton> : null}
        </Nav>
      ) : null}
    </View>
  );

  return (
    <MightsPage
      title={upcoming ? 'Upcoming in Harlem' : `Today in Harlem, ${todayHeading(now)}`}
      lead="Events with a date and a source, and when we last checked each one."
    >
      <View className="gap-4">
        <Nav aria-label="Event dates" className="flex flex-row flex-wrap gap-3">
          <MightsButton href={routes.today()} variant={upcoming ? 'outline' : 'primary'} aria-current={!upcoming ? 'page' : undefined}>Today</MightsButton>
          <MightsButton href={routes.today({ view: 'upcoming' })} variant={upcoming ? 'primary' : 'outline'} aria-current={upcoming ? 'page' : undefined}>Upcoming</MightsButton>
        </Nav>
        <MightsText size="small">
          {upcoming ? `${eventRangeLabel(range.start, range.end)}. Today and the next 89 days, including ongoing events.` : 'Events overlapping today in Harlem.'} Times shown in New York time.
        </MightsText>
      </View>
      {!upcoming ? <HistoryFact date={date} /> : null}
      {body}
    </MightsPage>
  );
}
