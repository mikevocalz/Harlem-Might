import type { Metadata } from 'next';
import { Suspense } from 'react';
import { io } from 'next/cache';
import { harlemToday } from '@acme/app/content';
import { TodayScreen } from '@acme/app/features/site/today/TodayScreen.tsx';
import { eventDateRange, eventSearch } from '@acme/app/features/site/today/event-query.ts';
import { cachedEventsForDateRange } from '@/lib/cached-content';
import { TodayDateRefresh } from '@/components/site/TodayDateRefresh';
import { TodayRetry } from '@/components/site/TodayRetry';
import { ContentLoader } from '@acme/app/features/site/content/ContentLoader.tsx';

export const metadata: Metadata = {
  title: 'Today & Upcoming',
  description: 'Today and upcoming events in Harlem, each with its source and when it was last checked.',
};

type SearchParams = Promise<{ view?: string | string[]; page?: string | string[] }>;

async function TodayContent({ searchParams }: { searchParams: SearchParams }) {
  // Request-time Harlem date, never the server UTC day or a build-time date.
  await io();
  const now = new Date();
  const date = harlemToday(now);
  const search = eventSearch(await searchParams);
  const { start, end } = eventDateRange(date, search.view);
  const result = await cachedEventsForDateRange(start, end, search.page);
  return <><TodayDateRefresh date={date} /><TodayScreen date={date} now={now} {...search} result={result} retryAction={<TodayRetry />} /></>;
}

export default function TodayPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<ContentLoader label="Checking for events" />}>
      <TodayContent searchParams={searchParams} />
    </Suspense>
  );
}
