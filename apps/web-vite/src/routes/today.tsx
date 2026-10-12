import { useEffect } from 'react';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { harlemToday, EVENTS_PAGE_SIZE } from '@acme/app/content';
import { eventDateRange, eventSearch } from '@acme/app/features/site/today/event-query.ts';
import { checkedAt, checkedLabel, eventRangeLabel, eventWhen, isStale, orderForToday, statusLabel, todayHeading, venueName } from '@acme/app/features/site/today/event-format.ts';
import { safeHttpUrl } from '@acme/app/features/site/content/safe-url.ts';
import { Button, Card, Heading, Text } from '@acme/ui';
import { Link as SourceLink, Time } from '@acme/ui/html';
import { Main, Nav, Section, View } from '@acme/ui/tw';
import { eventReaders } from '@/lib/events';

export const Route = createFileRoute('/today')({
  validateSearch: eventSearch,
  loaderDeps: ({ search }) => search,
  // Always re-read on navigation; never carry a prerendered "today" across days.
  staleTime: 0,
  preloadStaleTime: 0,
  loader: async ({ deps }) => {
    const now = new Date();
    const date = harlemToday(now);
    const range = eventDateRange(date, deps.view);
    const result = await eventReaders.listEventsForDateRange(range.start, range.end, deps.page);
    return { now: now.toISOString(), date, range, result: result.status === 'unavailable' ? { status: 'unavailable' as const } : result };
  },
  head: () => ({ meta: [{ title: 'Today & Upcoming in Harlem — Harlem Might' }] }),
  component: TodayPage,
  pendingComponent: () => <Text className="p-6">Checking for events…</Text>,
  errorComponent: () => <Text className="p-6">We couldn’t check for events right now. Please reload this page.</Text>,
});

const navLink = 'rounded-lg border border-border px-5 py-3 text-sm font-semibold text-primary focus-visible:outline focus-visible:outline-2';
const sourceLink = 'text-primary underline underline-offset-4';

function TodayPage() {
  const { now: instant, date, range, result } = Route.useLoaderData();
  const { view, page } = Route.useSearch();
  const router = useRouter();
  const now = new Date(instant);
  const upcoming = view === 'upcoming';
  useEffect(() => {
    const refreshDate = () => { if (harlemToday() !== date) void router.invalidate(); };
    const timer = window.setInterval(refreshDate, 30_000);
    document.addEventListener('visibilitychange', refreshDate);
    refreshDate();
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refreshDate); };
  }, [date, router]);
  return (
    <Main className="flex-1 bg-surface">
      <Section className="mx-auto w-full max-w-screen-2xl gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <View className="max-w-4xl gap-4">
          <Heading level={1} size="display-lg" className="text-text">{upcoming ? 'Upcoming in Harlem' : `Today in Harlem, ${todayHeading(now)}`}</Heading>
          <Text className="text-text-muted">Events with a date and a source, and when we last checked each one.</Text>
        </View>
        <Nav aria-label="Event dates" className="flex-row flex-wrap gap-3">
          <Link to="/today" search={{ view: 'today', page: 1 }} aria-current={!upcoming ? 'page' : undefined} className={`${navLink} ${!upcoming ? 'bg-surface-raised' : ''}`}>Today</Link>
          <Link to="/today" search={{ view: 'upcoming', page: 1 }} aria-current={upcoming ? 'page' : undefined} className={`${navLink} ${upcoming ? 'bg-surface-raised' : ''}`}>Upcoming</Link>
        </Nav>
        <Text className="text-sm text-text-muted">{upcoming ? `${eventRangeLabel(range.start, range.end)}. Today and the next 89 days, including ongoing events.` : 'Events overlapping today in Harlem.'} Times shown in New York time.</Text>
        {result.status === 'unavailable' ? (
          <View className="gap-4">
            <Heading level={2} size="title">We couldn’t check for events right now</Heading>
            <Text>Our records didn’t answer. Try again in a moment, or check the venue’s own site.</Text>
            <Button title="Try again" onPress={() => { void router.invalidate(); }} />
          </View>
        ) : result.data.events.length === 0 ? (
          <View className="gap-4">
            <Heading level={2} size="title">{page > 1 ? 'No events on this page' : `No events listed ${upcoming ? 'in this date range' : 'for today'}`}</Heading>
            <Text>Venue listings appear here once we’ve checked them.</Text>
            {upcoming && page === 1 ? <Link to="/explore" className={navLink}>Open the map</Link> :
              <Link to="/today" search={{ view: page > 1 ? view : 'upcoming', page: 1 }} className={navLink}>{page > 1 ? 'First page' : 'See upcoming events'}</Link>}
          </View>
        ) : (
          <>
            <Text className="text-sm text-text-muted">Showing {(page - 1) * EVENTS_PAGE_SIZE + 1}–{(page - 1) * EVENTS_PAGE_SIZE + result.data.events.length} of {result.data.totalDocs} listings.</Text>
            <View className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {orderForToday(result.data.events).map((event) => {
                const checked = checkedAt(event);
                const source = safeHttpUrl(event.sourceUrl);
                const ticket = event.status === 'scheduled' ? safeHttpUrl(event.ticketUrl) : null;
                const status = statusLabel(event.status);
                return (
                  <Card key={event.id} className="gap-4 border-border bg-surface-raised p-5 md:p-6">
                    <Text className="text-sm font-semibold">{status ? `${status}. ` : ''}<Time dateTime={event.startsAt}>{eventWhen(event, upcoming)}</Time></Text>
                    <Heading level={2} size="title" className={status ? 'line-through' : ''}>{event.title}</Heading>
                    <Text>{venueName(event)}</Text>
                    <View className="gap-2">
                      {ticket ? <SourceLink href={ticket} className={sourceLink}>Tickets for {event.title}</SourceLink> : null}
                      {source ? <SourceLink href={source} className={sourceLink}>Venue listing for {event.title}</SourceLink> : null}
                      <Text className="text-sm text-text-muted"><Time dateTime={checked}>{checkedLabel(checked, now)}</Time>{isStale(checked, now) ? '. Confirm with the venue before you go.' : '.'}</Text>
                    </View>
                  </Card>
                );
              })}
            </View>
            {(page > 1 || result.data.hasNextPage) ? (
              <Nav aria-label="Event pages" className="flex-row flex-wrap items-center gap-3">
                {page > 1 ? <Link to="/today" search={{ view, page: page - 1 }} className={navLink}>Previous page</Link> : null}
                <Text>Page {page}</Text>
                {result.data.hasNextPage ? <Link to="/today" search={{ view, page: page + 1 }} className={navLink}>Next page</Link> : null}
              </Nav>
            ) : null}
          </>
        )}
      </Section>
    </Main>
  );
}
