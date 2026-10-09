import type { PlaceRecord } from '../../content/records.ts';
import type { ExplorePlace } from './explore.store.ts';

// Adapts the Payload place catalogue into the shape the Explore workspace and
// place pages render. Nothing is invented here: absent facts stay absent, so
// "location pending" and empty description paths keep working.

/** The OSM object id ("node/123") inside an openstreetmap.org URL, for links and source lines. */
function osmRef(url: string | undefined): string | undefined {
  return url?.match(/openstreetmap\.org\/((?:node|way|relation)\/\d+)/)?.[1];
}

/** The street part of a formatted postal address ("2568 Park Ave, Bronx…" → "2568 Park Ave"). */
function streetOf(formatted: string | undefined): string | undefined {
  return formatted?.split(',')[0]?.trim() || undefined;
}

export function explorePlaceFromRecord(record: PlaceRecord): ExplorePlace {
  const category = record.category ?? 'Community';
  return {
    id: record.slug,
    name: record.name,
    category,
    area: record.area ?? 'Harlem',
    ...(streetOf(record.address) ? { street: streetOf(record.address) } : {}),
    ...(record.summary ? { shortDescription: record.summary } : {}),
    tags: [category, record.area].filter((v): v is string => Boolean(v)),
    lngLat: record.location,
    osm: osmRef(record.locationSourceUrl),
    sourceReadAt: record.locationSourceReadAt,
    website: record.website,
    ...(record.phone ? { phone: record.phone } : {}),
    ...(record.openingHours && (record.openingHours.osm || record.openingHours.note)
      ? { hoursText: record.openingHours.osm ?? record.openingHours.note }
      : {}),
    ...(record.menus?.length
      ? { menus: record.menus.flatMap((m) => (m.url ? [{ label: m.label, url: m.url }] : [])) }
      : {}),
    featured: record.featured,
  };
}

/** 'All' plus every category the catalogue actually uses, alphabetically. */
export function exploreCategories(places: readonly ExplorePlace[]): string[] {
  return ['All', ...new Set(places.map((p) => p.category))].sort((a, b) =>
    a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b),
  );
}
