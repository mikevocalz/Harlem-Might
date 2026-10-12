import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { contentQuery, contentQueryResult } from '@acme/app/content';
import { WalkScreen } from '@acme/app/features/site/walks/WalksScreen.tsx';
import { contentReaders } from '@/src/site/content-readers';

export default function WalkRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const query = useQuery({ queryKey: ['walk', slug], queryFn: ({ signal }) => contentQuery(contentReaders.getWalk(slug, { signal })) });
  return <WalkScreen slug={slug} result={contentQueryResult(query)} />;
}
