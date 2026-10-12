import { useQuery } from '@tanstack/react-query';
import { contentQuery, contentQueryResult } from '@acme/app/content';
import { WalksScreen } from '@acme/app/features/site/walks/WalksScreen.tsx';
import { contentReaders } from '@/src/site/content-readers';

export default function WalksRoute() {
  const query = useQuery({ queryKey: ['walks'], queryFn: ({ signal }) => contentQuery(contentReaders.listWalks({ signal })) });
  return <WalksScreen result={contentQueryResult(query)} />;
}
