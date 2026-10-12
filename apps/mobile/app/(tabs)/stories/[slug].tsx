import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { contentQuery, contentQueryResult } from '@acme/app/content';
import { StoryScreen } from '@acme/app/features/site/stories/StoriesScreen.tsx';
import { contentReaders } from '@/src/site/content-readers';

export default function StoryRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const story = useQuery({ queryKey: ['story', slug], queryFn: ({ signal }) => contentQuery(contentReaders.getStory(slug, { signal })) });
  const walks = useQuery({ queryKey: ['walks'], queryFn: ({ signal }) => contentQuery(contentReaders.listWalks({ signal })) });
  return <StoryScreen slug={slug} result={contentQueryResult(story)} walks={walks.data?.status === 'ok' ? walks.data.data : []} />;
}
