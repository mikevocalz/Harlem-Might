import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { StoryScreen } from '@acme/app/features/site/stories/StoriesScreen.tsx';
import { contentReaders } from '@/src/site/content-readers';

export default function StoryRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const story = useQuery({ queryKey: ['story', slug], queryFn: () => contentReaders.getStory(slug) });
  const walks = useQuery({ queryKey: ['walks'], queryFn: () => contentReaders.listWalks() });
  return <StoryScreen slug={slug} result={story.data} walks={walks.data?.status === 'ok' ? walks.data.data : []} />;
}
