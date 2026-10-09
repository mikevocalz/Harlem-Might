import { getPayload } from 'payload';
import { isGeneratedPlaceSlug, uniquePlaceSlug } from '@acme/app/content';
import config from './payload.config';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to rename place slugs.');
const apply = process.argv.includes('--apply');
const payload = await getPayload({ config });

const places: { id: number; name: string; slug: string; legacySlugs?: { slug: string }[] | null }[] = [];
for (let page = 1; ; page += 1) {
  const result = await payload.find({
    collection: 'places',
    limit: 100,
    page,
    depth: 0,
    overrideAccess: true,
    select: { name: true, slug: true, legacySlugs: true },
  });
  places.push(...result.docs);
  if (!result.hasNextPage) break;
}

const used = new Set(places.map((place) => place.slug));
const updates = places
  .filter((place) => isGeneratedPlaceSlug(place.slug))
  .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
  .flatMap((place) => {
    const current = place.slug;
    used.delete(current);
    const next = uniquePlaceSlug(place.name, used, current);
    used.add(next);
    return next === current ? [] : [{ id: place.id, current, next, name: place.name }];
  });

console.info(`${updates.length} generated place slug(s) can become name-led.`);
for (const update of updates.slice(0, 50)) console.info(`${update.current} → ${update.next} (${update.name})`);
if (updates.length > 50) console.info(`…and ${updates.length - 50} more.`);

if (apply) {
  for (const update of updates) {
    const place = places.find((entry) => entry.id === update.id);
    const legacySlugs = [...new Set([...(place?.legacySlugs ?? []).map((entry) => entry.slug), update.current])].map(
      (slug) => ({ slug }),
    );
    await payload.update({
      collection: 'places',
      id: update.id,
      data: { slug: update.next, legacySlugs },
      overrideAccess: true,
      depth: 0,
    });
  }
  console.info(`Renamed ${updates.length} place slugs. Legacy /places/* source-id paths now resolve through legacySlugs.`);
}
