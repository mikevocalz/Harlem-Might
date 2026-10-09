import type { Metadata } from 'next';
import { Suspense } from 'react';
import { cacheLife } from 'next/cache';
import { listExploreCatalogue, listExplorePoints } from '@acme/payload/server';
import type { ContentResult, PlaceRecord } from '@acme/payload/server';
import { HARLEM_PLACE_PREVIEWS, type ExplorePlace } from '@acme/app/features/explore/explore.store.ts';
import { explorePlaceFromRecord } from '@acme/app/features/explore/catalogue.ts';
import { ExploreWorkspace } from '../../../components/explore/ExploreWorkspace';
import { ExplorePageLoader } from '../../../components/explore/ExploreSkeletons';
import type { MapPlace } from '../../../components/explore/ExploreMap';

export const metadata: Metadata = {
  title: 'Explore',
  description: 'Find a place in Harlem on the map or in the list, and open its story.',
};

export default function ExplorePage() {
  return (
    // One boundary for the whole stage: list, map and sheet reveal together.
    <Suspense fallback={<ExplorePageLoader />}>
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

// Cached, not per-request: a return visit (and the Link prefetch) reuses the
// shell instead of re-reading both tables. No revalidateTag hooks exist on
// the Places collection yet, so `minutes` bounds how long a CMS edit takes
// to show. A miss (no DATABASE_URL at build, or a failed read) drops to
// `seconds`, which Next keeps out of the prerender — the fixture is never
// baked into the static shell.
async function readExplore() {
  'use cache';
  const [points, catalogue] = await Promise.all([listExplorePoints(), listExploreCatalogue()]);
  cacheLife(points.status === 'ok' && catalogue.status === 'ok' ? 'minutes' : 'seconds');
  return { points: resolvePoints(points), catalogue: resolveCatalogue(catalogue) };
}

async function ExploreContent() {
  const { points, catalogue } = await readExplore();
  return <ExploreWorkspace points={points} catalogue={catalogue} />;
}
