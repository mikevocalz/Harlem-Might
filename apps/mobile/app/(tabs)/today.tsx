import { useQuery } from '@tanstack/react-query';
import { harlemToday } from '@acme/app/content';
import { TodayScreen } from '@acme/app/features/site/today/TodayScreen.tsx';
import { contentReaders } from '@/src/site/content-readers';

export default function TodayRoute() {
  const now = new Date();
  const date = harlemToday(now);
  const { data } = useQuery({ queryKey: ['events', date], queryFn: () => contentReaders.listEventsForDate(date) });
  return <TodayScreen date={date} now={now} result={data} />;
}
