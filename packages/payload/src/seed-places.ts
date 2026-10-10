import { getPayload } from 'payload';
import { uniquePlaceSlug } from '@acme/app/content';
import { HARLEM_PLACE_PREVIEWS, type HarlemPlaceCategory } from '@acme/app/features/explore/explore.store.ts';
import { bboxOf, containingNta, fetchNtaBoundaries } from './nta.ts';
import { readOsmFeatures, representativePoint, type OsmFeature } from './osm.ts';
import config from './payload.config';
import type { Place } from './payload-types';

const kinds: Record<HarlemPlaceCategory, 'business' | 'culture' | 'historic' | 'outdoors'> = {
  Food: 'business', Music: 'culture', Culture: 'culture', Books: 'culture', History: 'historic', Outdoors: 'outdoors',
};

type PlaceData = Pick<Place, 'name' | 'slug' | 'kind' | 'lifecycle' | 'locationAccuracy'> &
  Partial<
    Pick<Place, 'primaryCategory' | 'primaryArea' | 'summary' | 'location' | 'locationSource' | 'dataQuality' | 'website' | 'address' | 'featured' | 'legacySlugs'>
  >;

function osmKind(tags: Record<string, string>): Place['kind'] {
  if (tags.historic) return 'historic';
  if (tags.leisure === 'park' || tags.landuse === 'recreation_ground') return 'outdoors';
  if (['museum', 'theatre', 'arts_centre', 'gallery', 'music_venue', 'library'].includes(tags.tourism ?? tags.amenity ?? '')) return 'culture';
  if (tags.amenity || tags.shop || tags.office || tags.craft) return 'business';
  return 'community';
}

function osmCategory(tags: Record<string, string>): string {
  if (tags.historic) return 'History';
  if (tags.leisure === 'park' || tags.landuse === 'recreation_ground') return 'Outdoors';
  if (tags.amenity === 'library' || tags.shop === 'books') return 'Books';
  if (['museum', 'theatre', 'arts_centre', 'gallery', 'music_venue'].includes(tags.tourism ?? tags.amenity ?? '')) return 'Culture';
  if (['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'food_court'].includes(tags.amenity ?? '') || tags.cuisine) return 'Food';
  if (tags.shop) return 'Shops';
  if (tags.amenity || tags.office || tags.craft) return 'Community';
  return 'Outdoors';
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to import places.');
const apply = process.argv.includes('--apply');
const ntas = await fetchNtaBoundaries();
const bbox = bboxOf(ntas);
console.info(`Using Harlem NTA bounding box ${bbox}.`);
const pbfPath = process.env.OSM_PBF_PATH;
if (!pbfPath) throw new Error('Set OSM_PBF_PATH to the downloaded Geofabrik New York PBF extract.');
const osmFeatures = await readOsmFeatures(pbfPath, bbox);
const inputs = new Map<string, PlaceData>();
const curatedOsm = new Map(HARLEM_PLACE_PREVIEWS.filter((p) => p.osm).map((p) => [p.osm, p.id]));
for (const feature of osmFeatures) {
  const tags = feature.properties;
  const name = tags.name?.trim();
  const point = representativePoint(feature.geometry);
  if (!name || !point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue;
  const area = containingNta(point, ntas);
  if (!area) continue;
  const type = tags['@type'];
  const osmObjectId = tags['@id'];
  if (!type || !osmObjectId || !['node', 'way', 'relation'].includes(type)) continue;
  const osmId = `${type}/${osmObjectId}`;
  const sourceSlug = `osm-${type}-${osmObjectId}`;
  // Public paths are name-led ("the-edge"); the OSM object id remains in
  // locationSource.url and as the legacy redirect target, not in the slug.
  const slug = curatedOsm.get(osmId) ?? uniquePlaceSlug(name, new Set(inputs.keys()), sourceSlug);
  if (inputs.has(slug)) continue;
  const category = osmCategory(tags);
  const data: PlaceData = {
    name, slug, kind: osmKind(tags), lifecycle: 'unknown', primaryCategory: category, primaryArea: area.properties.ntaname,
    location: point, locationAccuracy: 'approx',
    locationSource: { url: `https://www.openstreetmap.org/${osmId}` },
    legacySlugs: [{ slug: sourceSlug }],
    dataQuality: { state: 'unverified' },
  };
  inputs.set(slug, data);
}
for (const place of HARLEM_PLACE_PREVIEWS) {
  const existing = inputs.get(place.id);
  const curatedData: PlaceData = {
    ...existing,
    name: place.name, slug: place.id, kind: kinds[place.category], lifecycle: 'unknown',
    primaryCategory: place.category, primaryArea: place.area, summary: place.shortDescription,
    featured: true,
    locationAccuracy: existing?.location || place.lngLat ? 'approx' : 'pending',
    dataQuality: { state: 'unverified' },
    ...(existing?.location ? {} : place.lngLat ? { location: [place.lngLat[0], place.lngLat[1]] } : {}),
    ...(place.osm
      ? {
          locationSource: { url: `https://www.openstreetmap.org/${place.osm}` },
          legacySlugs: [{ slug: `osm-${place.osm.replace('/', '-')}` }],
        }
      : {}),
  };
  inputs.set(place.id, curatedData);
}
const rosa: PlaceData = {
  name: "Rosa's At Park", slug: 'rosas-at-park', kind: 'business', lifecycle: 'unknown',
  primaryCategory: 'Food', primaryArea: 'Bronx (explicit exception)',
  summary: 'Latin fusion restaurant with indoor dining and a rooftop.',
  website: 'https://rosaatpark.com/',
  address: { formatted: '2568 Park Ave, 1st Floor, Bronx, NY 10451' },
  locationAccuracy: 'pending', dataQuality: { state: 'unverified' },
  featured: true,
};
inputs.set(rosa.slug, rosa);

const payload = await getPayload({ config });
const slugs = [...inputs.keys()];
const existing = new Set<string>();
for (let page = 1; ; page++) {
  const result = await payload.find({ collection: 'places', limit: 100, page, depth: 0, overrideAccess: true });
  result.docs.forEach((doc) => existing.add(doc.slug));
  if (!result.hasNextPage) break;
}
const missing = slugs.filter((slug) => !existing.has(slug));
const areaCounts = new Map<string, number>();
for (const data of inputs.values()) areaCounts.set(data.primaryArea ?? 'Unknown', (areaCounts.get(data.primaryArea ?? 'Unknown') ?? 0) + 1);
console.info(`NYC NTAs: ${ntas.map((nta) => nta.properties.ntaname).join(', ')}. OSM features: ${osmFeatures.length}; in-area named places plus curated previews and Rosa's exception: ${slugs.length}. Existing: ${slugs.length - missing.length}; new: ${missing.length}.`);
console.info(`Records by area: ${[...areaCounts].map(([area, count]) => `${area}: ${count}`).join('; ')}`);
if (!apply) {
  console.info(`Preview only; pass --apply to insert. Sample: ${missing.slice(0, 20).map((slug) => `${inputs.get(slug)?.name} [${inputs.get(slug)?.primaryCategory}, ${inputs.get(slug)?.primaryArea}]`).join('; ')}`);
} else {
  for (const slug of missing) {
    await payload.create({ collection: 'places', overrideAccess: true, data: inputs.get(slug)! });
    console.info(`Created ${slug}`);
  }
  // Rows inserted by an earlier run still get the curated flag — featured
  // marks the landmarks that keep a labelled marker at any zoom.
  const featuredSlugs = [...HARLEM_PLACE_PREVIEWS.map((p) => p.id), rosa.slug];
  const flagged = await payload.update({
    collection: 'places',
    where: { and: [{ slug: { in: featuredSlugs } }, { featured: { not_equals: true } }] },
    data: { featured: true },
    overrideAccess: true,
    depth: 0,
  });
  console.info(`Created ${missing.length} places; existing records unchanged. Flagged ${flagged.docs.length} curated places as featured.`);
}
