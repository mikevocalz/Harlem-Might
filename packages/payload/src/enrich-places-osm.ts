import { getPayload } from 'payload';
import { HARLEM_PLACE_PREVIEWS } from '@acme/app/features/explore/explore.store.ts';
import { isHttpUrl } from './fields/provenance.ts';
import { bboxOf, fetchNtaBoundaries } from './nta.ts';
import { readOsmFeatures } from './osm.ts';
import config from './payload.config';
import type { Place } from './payload-types';

// Second pass over the OSM extract: the first import kept name + point and
// dropped the rest of the tags. This writes the tags back onto existing
// records — website, phone, opening_hours, address, menu URL, description —
// filling EMPTY fields only, never overwriting curated or hand-entered data.
// Provenance stays honest: every hours/menu row carries its OSM object URL.
//
// `pnpm enrich:osm` previews per-field counts; `--apply` writes.
// Needs OSM_PBF_PATH (the downloaded New York extract).

type Existing = Pick<Place, 'id' | 'slug' | 'name' | 'website' | 'phone' | 'summary' | 'menus'> & {
  address?: { formatted?: string | null } | null;
  openingHours?: { osm?: string | null } | null;
};

const first = (value: string | undefined) => value?.split(';')[0]?.trim();

function osmAddress(tags: Record<string, string>): string | undefined {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ').trim();
  if (!street) return undefined;
  const city = tags['addr:city'] ?? 'New York';
  const postcode = tags['addr:postcode'] ? ` ${tags['addr:postcode']}` : '';
  return `${street}, ${city}, NY${postcode}`;
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const apply = process.argv.includes('--apply');
const pbfPath = process.env.OSM_PBF_PATH;
if (!pbfPath) throw new Error('Set OSM_PBF_PATH to the downloaded Geofabrik New York PBF extract.');

const ntas = await fetchNtaBoundaries();
const features = await readOsmFeatures(pbfPath, bboxOf(ntas));

const payload = await getPayload({ config });
const placesBySlug = new Map<string, Existing>();
for (let page = 1; ; page++) {
  const result = await payload.find({
    collection: 'places',
    limit: 100,
    page,
    depth: 0,
    overrideAccess: true,
    select: { name: true, slug: true, website: true, phone: true, summary: true, address: true, openingHours: true, menus: true },
  });
  result.docs.forEach((doc) => placesBySlug.set(doc.slug, doc as unknown as Existing));
  if (!result.hasNextPage) break;
}

const curatedOsm = new Map(HARLEM_PLACE_PREVIEWS.filter((p) => p.osm).map((p) => [p.osm, p.id]));
const verifiedAt = new Date().toISOString();
const stats = { website: 0, phone: 0, hours: 0, address: 0, menu: 0, summary: 0, skipped: 0 };
const updates: { id: number; slug: string; data: Record<string, unknown> }[] = [];

for (const feature of features) {
  const tags = feature.properties;
  const type = tags['@type'];
  const osmObjectId = tags['@id'];
  if (!type || !osmObjectId) continue;
  const osmId = `${type}/${osmObjectId}`;
  const slug = curatedOsm.get(osmId) ?? `osm-${type}-${osmObjectId}`;
  const place = placesBySlug.get(slug);
  if (!place) continue;
  const sourceUrl = `https://www.openstreetmap.org/${osmId}`;
  const data: Record<string, unknown> = {};

  const website = first(tags.website ?? tags['contact:website'] ?? tags.url);
  if (!place.website && website && isHttpUrl(website)) {
    data.website = website;
    stats.website++;
  }
  const phone = first(tags.phone ?? tags['contact:phone']);
  if (!place.phone && phone) {
    data.phone = phone;
    stats.phone++;
  }
  const hours = first(tags.opening_hours);
  if (!place.openingHours?.osm && hours) {
    data.openingHours = { osm: hours, sourceUrl, verifiedAt };
    stats.hours++;
  }
  const address = osmAddress(tags);
  if (!place.address?.formatted && address) {
    data.address = { formatted: address, postalCode: tags['addr:postcode'] ?? undefined };
    stats.address++;
  }
  const menu = first(tags.menu ?? tags['url:menu'] ?? tags['contact:menu']);
  if ((!place.menus || place.menus.length === 0) && menu && isHttpUrl(menu)) {
    data.menus = [{ label: 'Menu', format: 'web', url: menu, sourceUrl, lastVerifiedAt: verifiedAt, active: true }];
    stats.menu++;
  }
  const description = first(tags.description);
  if (!place.summary && description && description.length > 20) {
    data.summary = description;
    stats.summary++;
  }
  if (Object.keys(data).length) updates.push({ id: place.id, slug, data });
  else stats.skipped++;
}

console.info(
  `OSM features ${features.length}; matched places with new data ${updates.length}; already complete/skipped ${stats.skipped}. ` +
    `New fields → website ${stats.website}, phone ${stats.phone}, hours ${stats.hours}, address ${stats.address}, menu ${stats.menu}, summary ${stats.summary}.`,
);
if (!apply) {
  console.info(
    `Preview only; pass --apply to write. Sample: ${updates
      .slice(0, 15)
      .map((u) => `${u.slug}: ${Object.keys(u.data).join('+')}`)
      .join('; ')}`,
  );
} else {
  for (const update of updates) {
    await payload.update({ collection: 'places', id: update.id, data: update.data as Partial<Place>, overrideAccess: true });
    console.info(`Enriched ${update.slug}: ${Object.keys(update.data).join(', ')}`);
  }
  console.info(`Updated ${updates.length} places from OSM tags.`);
}
