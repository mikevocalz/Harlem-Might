import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { WalkScreen } from '@acme/app/features/site/walks/WalksScreen.tsx';
import { contentReaders } from '@/src/site/content-readers';

export default function WalkRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data } = useQuery({ queryKey: ['walk', slug], queryFn: () => contentReaders.getWalk(slug) });
  return <WalkScreen slug={slug} result={data} />;
}
