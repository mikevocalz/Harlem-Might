import { useQuery } from '@tanstack/react-query';
import { StoriesScreen } from '@acme/app/features/site/stories/StoriesScreen.tsx';
import { contentReaders } from '@/src/site/content-readers';

export default function StoriesRoute() {
  const { data } = useQuery({ queryKey: ['stories'], queryFn: () => contentReaders.listStories() });
  return <StoriesScreen result={data} />;
}
