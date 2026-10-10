import { getPayload } from 'payload';
import config from './payload.config';

// Link imported media to the places it depicts. Matching is conservative:
// the place's name must appear in the media's alt text (so "Apollo Theater,
// Harlem (2009)" lands on apollo-theater, not on every Apollo row). Generic
// Harlem photos match nothing and stay unattached — that's correct, they're
// story/gallery assets, not place portraits.
//
// `pnpm link:media` previews; `--apply` writes. Existing images are kept.

const normalize = (text: string) => text.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
// Name fragments too short or generic to match on.
const MIN_NAME_LEN = 5;

const payload = await getPayload({ config });
const apply = process.argv.includes('--apply');

const places: { id: number; slug: string; name: string; images?: unknown[] | null }[] = [];
for (let page = 1; ; page++) {
  const result = await payload.find({ collection: 'places', limit: 100, page, depth: 0, overrideAccess: true, select: { slug: true, name: true, images: true } });
  places.push(...(result.docs as unknown as typeof places));
  if (!result.hasNextPage) break;
}
const media: { id: number; alt: string }[] = [];
for (let page = 1; ; page++) {
  const result = await payload.find({ collection: 'media', limit: 100, page, depth: 0, overrideAccess: true, select: { alt: true } });
  media.push(...(result.docs as unknown as typeof media));
  if (!result.hasNextPage) break;
}

// Longer names first so "Apollo Theater" beats a shorter overlapping name.
const named = places
  .map((p) => ({ ...p, key: normalize(p.name) }))
  .filter((p) => p.key.length >= MIN_NAME_LEN)
  .sort((a, b) => b.key.length - a.key.length);

const links = new Map<number, Set<number>>();
for (const item of media) {
  const haystack = ` ${normalize(item.alt)} `;
  for (const place of named) {
    if (haystack.includes(` ${place.key} `) || haystack.startsWith(`${place.key} `) || haystack.includes(`${place.key} `)) {
      links.set(place.id, (links.get(place.id) ?? new Set()).add(item.id));
      break; // one photo attaches to one place
    }
  }
}

console.info(`Media ${media.length}; places ${places.length}; matched ${links.size} places → ${[...links.values()].reduce((n, s) => n + s.size, 0)} images.`);
if (!apply) {
  console.info(
    `Preview only; pass --apply to write. Sample: ${[...links.entries()]
      .slice(0, 15)
      .map(([pid, ids]) => `${named.find((p) => p.id === pid)?.slug} ← ${[...ids].map((id) => media.find((m) => m.id === id)?.alt.slice(0, 40)).join(', ')}`)
      .join('; ')}`,
  );
} else {
  for (const [placeId, mediaIds] of links) {
    const place = places.find((p) => p.id === placeId)!;
    const existing = (place.images ?? []).map((img) => (typeof img === 'number' ? img : (img as { id: number }).id));
    await payload.update({ collection: 'places', id: placeId, data: { images: [...new Set([...existing, ...mediaIds])] }, overrideAccess: true });
    console.info(`${place.slug}: ${mediaIds.size} image(s)`);
  }
  console.info(`Linked images on ${links.size} places.`);
}
