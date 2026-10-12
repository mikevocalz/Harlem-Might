import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { harlemToday } from '@acme/app/content';
import { MightsButton } from '@acme/ui/mights';
import { TodayScreen } from '@acme/app/features/site/today/TodayScreen.tsx';
import { eventQuery, eventSearch } from '@acme/app/features/site/today/event-query.ts';
import { contentReaders } from '@/src/site/content-readers';

const currentDate = () => harlemToday();
const subscribeDate = (changed: () => void) => {
  // Advance the query key at Harlem midnight, including after background/resume.
  const timer = setInterval(changed, 30_000);
  const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') changed(); });
  return () => { clearInterval(timer); subscription.remove(); };
};

export default function TodayRoute() {
  const search = eventSearch(useLocalSearchParams<{ view?: string; page?: string }>());
  const date = useSyncExternalStore(subscribeDate, currentDate, currentDate);
  const { data, isError, isFetching, refetch } = useQuery({
    ...eventQuery(contentReaders, date, search),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  return <TodayScreen date={date} now={new Date()} {...search}
    result={isError ? { status: 'unavailable' } : data}
    retryAction={<MightsButton disabled={isFetching} onPress={() => { void refetch(); }}>{isFetching ? 'Checking…' : 'Try again'}</MightsButton>}
  />;
}
