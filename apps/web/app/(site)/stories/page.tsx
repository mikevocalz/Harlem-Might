import type { Metadata } from 'next';
import { cachedStories } from '@/lib/cached-content';
import { StoriesScreen } from '@acme/app/features/site/stories/StoriesScreen.tsx';

export const metadata: Metadata = {
  title: 'Stories',
  description: 'The history behind Harlem blocks, attached to the places where it happened.',
};

export default async function StoriesPage() {
  return <StoriesScreen result={await cachedStories()} />;
}
