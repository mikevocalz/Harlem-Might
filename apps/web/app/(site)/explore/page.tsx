import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { listExploreCatalogue } from '@acme/payload/server';
import {
  HARLEM_CATEGORIES,
  HARLEM_PLACE_PREVIEWS,
} from '@acme/app/features/explore/explore.store.ts';
import { exploreCategories, explorePlaceFromRecord } from '@acme/app/features/explore/catalogue.ts';
import { ExploreWorkspace } from '../../../components/explore/ExploreWorkspace';

export const metadata: Metadata = {
  title: 'Explore',
  description: 'Find a place in Harlem on the map or in the list, and open its story.',
};

export default function ExplorePage() {
  return (
    <Suspense>
      <ExploreContent />
    </Suspense>
  );
}

// Read at request time: the build has no content database, and a build-time
// "unavailable" must never be baked into the static shell.
async function ExploreContent() {
  await connection();
  const result = await listExploreCatalogue();
  if (result.status !== 'ok' || result.data.length === 0) {
    if (result.status === 'unavailable' && result.reason === 'query-failed') {
      console.error('places read failed', result.error);
    }
    // The preview fixture keeps Explore usable when the catalogue cannot
    // answer (no DATABASE_URL in dev, or a failed query).
    return <ExploreWorkspace places={HARLEM_PLACE_PREVIEWS} categories={HARLEM_CATEGORIES} />;
  }
  const places = result.data.map(explorePlaceFromRecord);
  return <ExploreWorkspace places={places} categories={exploreCategories(places)} />;
}
