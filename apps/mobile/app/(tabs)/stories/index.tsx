import { useQuery } from '@tanstack/react-query';
import { contentQuery, contentQueryResult } from '@acme/app/content';
import { StoriesScreen } from '@acme/app/features/site/stories/StoriesScreen.tsx';
import { contentReaders } from '@/src/site/content-readers';

export default function StoriesRoute() {
  const query = useQuery({ queryKey: ['stories'], queryFn: ({ signal }) => contentQuery(contentReaders.listStories({ signal })) });
  return <StoriesScreen result={contentQueryResult(query)} />;
}
