import { useQuery } from '@tanstack/react-query';
import { contentQuery, contentQueryResult, harlemToday } from '@acme/app/content';
import { TodayScreen } from '@acme/app/features/site/today/TodayScreen.tsx';
import { contentReaders } from '@/src/site/content-readers';

export default function TodayRoute() {
  const now = new Date();
  const date = harlemToday(now);
  const query = useQuery({ queryKey: ['events', date], queryFn: ({ signal }) => contentQuery(contentReaders.listEventsForDate(date, { signal })) });
  return <TodayScreen date={date} now={now} result={contentQueryResult(query)} />;
}
