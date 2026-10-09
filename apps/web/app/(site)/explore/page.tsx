import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { listExploreCatalogue, listExplorePoints } from '@acme/payload/server';
import type { ContentResult, PlaceRecord } from '@acme/payload/server';
import { HARLEM_PLACE_PREVIEWS, type ExplorePlace } from '@acme/app/features/explore/explore.store.ts';
import { explorePlaceFromRecord } from '@acme/app/features/explore/catalogue.ts';
import { ExploreWorkspace } from '../../../components/explore/ExploreWorkspace';
import type { MapPlace } from '../../../components/explore/ExploreMap';

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

// The preview fixture keeps Explore usable when the catalogue cannot
// answer (no DATABASE_URL in dev, or a failed query).
const FIXTURE: readonly ExplorePlace[] = HARLEM_PLACE_PREVIEWS;

function resolveCatalogue(result: ContentResult<PlaceRecord[]>): readonly ExplorePlace[] {
  if (result.status === 'unavailable' && result.reason === 'query-failed') {
    console.error('places read failed', result.error);
  }
  if (result.status !== 'ok' || result.data.length === 0) return FIXTURE;
  return result.data.map(explorePlaceFromRecord);
}

// The map serializes only what its markers read — a row here is ~80 bytes,
// so the points promise lands well before the catalogue it would otherwise
// share a stream with.
function resolvePoints(result: ContentResult<PlaceRecord[]>): readonly MapPlace[] {
  if (result.status === 'unavailable' && result.reason === 'query-failed') {
    console.error('map points read failed', result.error);
  }
  if (result.status !== 'ok' || result.data.length === 0) {
    return FIXTURE.flatMap((p) => (p.lngLat ? [{ id: p.id, name: p.name, lngLat: p.lngLat }] : []));
  }
  return result.data.flatMap((r) => (r.location ? [{ id: r.slug, name: r.name, lngLat: r.location }] : []));
}

// Read at request time: the build has no content database, and a build-time
// "unavailable" must never be baked into the static shell. The two reads
// stay unresolved — React streams each into the workspace as it lands, so
// the map region (points) never waits on the catalogue the list needs.
async function ExploreContent() {
  await connection();
  const pointsPromise = listExplorePoints().then(resolvePoints);
  const cataloguePromise = listExploreCatalogue().then(resolveCatalogue);
  return <ExploreWorkspace pointsPromise={pointsPromise} cataloguePromise={cataloguePromise} />;
}
