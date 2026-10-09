import { useQuery } from '@tanstack/react-query';
import { WalksScreen } from '@acme/app/features/site/walks/WalksScreen.tsx';
import { contentReaders } from '@/src/site/content-readers';

export default function WalksRoute() {
  const { data } = useQuery({ queryKey: ['walks'], queryFn: () => contentReaders.listWalks() });
  return <WalksScreen result={data} />;
}
