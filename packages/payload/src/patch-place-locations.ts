import { getPayload } from 'payload';
import config from './payload.config';

// Backfill coordinates for featured places the fixture imported as 'pending'.
// Each update names its source; nothing is approximated by hand.
//   - strivers-row        → OSM node 357642389 (already an imported row's point)
//   - national-black-theatre → NYC Planning GeoSearch hit for its official
//                            address, 2031 Fifth Avenue (the new NBT building)
// `pnpm exec payload run src/patch-place-locations.ts`

const UPDATES: { slug: string; location: [number, number]; sourceUrl: string; sourceLabel: string }[] = [
  {
    slug: 'strivers-row',
    location: [-73.9438659, 40.8179379],
    sourceUrl: 'https://www.openstreetmap.org/node/357642389',
    sourceLabel: 'OpenStreetMap node 357642389 (Saint Nicholas Striver’s Row Historic District)',
  },
  {
    slug: 'national-black-theatre',
    location: [-73.94171, 40.80666],
    sourceUrl: 'https://geosearch.planninglabs.nyc/v2/search?text=2031%20Fifth%20Avenue',
    sourceLabel: 'NYC Planning GeoSearch — 2031 Fifth Avenue (National Black Theatre building)',
  },
];

const payload = await getPayload({ config });
for (const update of UPDATES) {
  const found = await payload.find({ collection: 'places', where: { slug: { equals: update.slug } }, limit: 1, depth: 0, overrideAccess: true });
  const doc = found.docs[0];
  if (!doc) {
    console.warn(`No place ${update.slug}; skipped.`);
    continue;
  }
  await payload.update({
    collection: 'places',
    id: doc.id,
    data: {
      location: update.location,
      locationAccuracy: 'approx',
      locationSource: { url: update.sourceUrl, verifiedAt: new Date().toISOString() },
    },
    overrideAccess: true,
  });
  console.info(`Updated ${update.slug} → ${update.location} (${update.sourceLabel})`);
}
