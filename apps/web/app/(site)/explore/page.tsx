import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ExploreWorkspace } from '../../../components/explore/ExploreWorkspace';

export const metadata: Metadata = {
  title: 'Explore',
  description: 'Find a place in Harlem on the map or in the list, and open its story.',
};

export default function ExplorePage() {
  return (
    <Suspense>
      <ExploreWorkspace />
    </Suspense>
  );
}
