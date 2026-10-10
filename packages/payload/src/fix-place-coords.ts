import { getPayload } from 'payload';
import config from './payload.config';

// Backfills `location` for imported places that have none — Parks monuments
// whose source rows carry a description but no geometry, plus the curated
// out-of-boundary exception.
//
// Monuments resolve through their own provenance chain: the monument's Socrata
// row names its park (`parknumber`), the Parks Properties dataset (`enfh-gkve`)
// maps that code to the park's official multipolygon, and the pin is the
// park centroid — honest for "somewhere inside this park". Records without a
// park code fall back to GeoSearch on the address text or place name.
//
// Every geocode must land in Manhattan or the Bronx (the Mott Haven exception):
// a bare name like "Voice 4" otherwise resolves to a Queens charter school.
// Points are marked `locationAccuracy: 'approx'` with the dataset or geocoder
// URL as `locationSource.url`.
//
// `pnpm exec payload run src/fix-place-coords.ts` previews; `--apply` writes.

const APPLY = process.argv.includes('--apply');
const GEOSEARCH = process.env.GEOSEARCH_BASE_URL ?? 'https://geosearch.planninglabs.nyc/v2';
const SOCRATA = 'https://data.cityofnewyork.us/resource';
const UA = { 'User-Agent': process.env.EVENTS_SCRAPER_USER_AGENT ?? 'HarlemMightBot/1.0' };
const ALLOWED_BOROUGHS = new Set(['Manhattan', 'Bronx']);
const BBOX = { minLng: -74.03, maxLng: -73.9, minLat: 40.75, maxLat: 40.88 };

const inBbox = ([lng, lat]: [number, number]) =>
  lng >= BBOX.minLng && lng <= BBOX.maxLng && lat >= BBOX.minLat && lat <= BBOX.maxLat;

interface GeoFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: { borough?: string; confidence?: number; name?: string; label?: string };
}

// A venue-name query ("Maher Circle") can resolve to an unrelated place with a
// generic word in common ("Columbus Circle"). Require the matched label to
// share a distinctive token — house numbers, ordinals and proper names count,
// street suffixes and city words don't.
const GENERIC_TOKENS = new Set([
  'new', 'york', 'nyc', 'manhattan', 'bronx', 'harlem', 'street', 'avenue', 'circle', 'drive',
  'park', 'place', 'road', 'lane', 'terrace', 'boulevard', 'plaza', 'east', 'west', 'north', 'south', 'st', 'ave', 'rd', 'dr', 'blvd', 'the',
]);

const tokensOf = (text: string): Set<string> =>
  new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3 && !GENERIC_TOKENS.has(token)),
  );

const labelMatches = (query: string, feature: GeoFeature): boolean => {
  const label = `${feature.properties?.name ?? ''} ${feature.properties?.label ?? ''}`;
  const labelTokens = tokensOf(label);
  for (const token of tokensOf(query)) {
    if (labelTokens.has(token)) return true;
  }
  return false;
};

const fetchJson = async <T>(url: string): Promise<T | undefined> => {
  try {
    const response = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15_000) });
    return response.ok ? ((await response.json()) as T) : undefined;
  } catch {
    return undefined;
  }
};

const geocode = async (query: string): Promise<{ point: [number, number]; queryUrl: string } | undefined> => {
  if (!query.trim()) return undefined;
  const queryUrl = `${GEOSEARCH}/search?text=${encodeURIComponent(query)}&size=1`;
  const data = await fetchJson<{ features?: GeoFeature[] }>(queryUrl);
  const feature = data?.features?.[0];
  const point = feature?.geometry?.coordinates;
  const borough = feature?.properties?.borough;
  if (!point || (borough && !ALLOWED_BOROUGHS.has(borough)) || !inBbox(point) || !labelMatches(query, feature)) return undefined;
  return { point, queryUrl };
};

// Centroid of the largest ring in a MultiPolygon — the park's center of mass.
const parkCentroid = (multipolygon: unknown): [number, number] | undefined => {
  const coords = (multipolygon as { coordinates?: number[][][][] })?.coordinates;
  if (!coords?.length) return undefined;
  let best: { sum: [number, number]; n: number } | undefined;
  for (const polygon of coords) {
    for (const ring of polygon) {
      if (!best || ring.length > best.n) {
        const sum = ring.reduce<[number, number]>((acc, [lng = 0, lat = 0]) => [acc[0] + lng, acc[1] + lat], [0, 0]);
        best = { sum, n: ring.length };
      }
    }
  }
  return best ? [best.sum[0] / best.n, best.sum[1] / best.n] : undefined;
};

// Monument rows name their park by property number (e.g. M014). Join through
// Parks Properties for the official footprint.
const monumentParkPoint = async (sourceUrl: string | null | undefined): Promise<{ point: [number, number]; queryUrl: string } | undefined> => {
  const number = sourceUrl?.match(/6rrm-vxj9\.json\?number=(\d+)/)?.[1];
  if (!number) return undefined;
  const monument = await fetchJson<{ parknumber?: string }[]>(`${SOCRATA}/6rrm-vxj9.json?number=${number}&$select=parknumber`);
  const parknumber = monument?.[0]?.parknumber;
  if (!parknumber) return undefined;
  const queryUrl = `${SOCRATA}/enfh-gkve.json?gispropnum=${encodeURIComponent(parknumber)}&$select=signname,multipolygon`;
  const park = await fetchJson<{ signname?: string; multipolygon?: unknown }[]>(queryUrl);
  const point = park?.[0] ? parkCentroid(park[0].multipolygon) : undefined;
  return point && inBbox(point) ? { point, queryUrl } : undefined;
};

// The imported `formatted` text mixes named places, intersections, and room
// descriptions, comma-separated, with a trailing "New York, NY". Clauses that
// carry a street number or intersection are the most specific candidates and
// are tried first — a bare name ("Maher Circle") can resolve to a different
// named venue across town.
const addressQueries = (formatted: string | null | undefined): string[] => {
  if (!formatted) return [];
  const clauses = formatted
    .split(';')[0]
    ?.split(',')
    .map((clause) => clause.trim().replace(/^"|"$/g, ''))
    .filter((clause) => clause.length >= 6 && !/^(new york|nyc|ny|manhattan|bronx)$/i.test(clause));
  if (!clauses?.length) return [];
  const localized = (clause: string) => (`${clause}, New York, NY`);
  const withAmpersand = (query: string) => (query.includes(' and ') ? [query.replace(/ and /g, ' & ')] : []);
  const specific = clauses.filter((clause) => /\d/.test(clause)).flatMap((clause) => [localized(clause), ...withAmpersand(localized(clause))]);
  const generic = clauses.filter((clause) => !/\d/.test(clause)).flatMap((clause) => [localized(clause), ...withAmpersand(localized(clause))]);
  return [...specific, ...generic];
};

const payload = await getPayload({ config });

let page = 1;
const pending: { id: number; slug: string; name: string; formatted: string | null; sourceUrl: string | null }[] = [];
for (;;) {
  const found = await payload.find({ collection: 'places', limit: 500, page, depth: 0, overrideAccess: true });
  for (const doc of found.docs) {
    if (!doc.location) {
      pending.push({
        id: doc.id,
        slug: doc.slug,
        name: doc.name,
        formatted: doc.address?.formatted ?? null,
        sourceUrl: doc.locationSource?.url ?? null,
      });
    }
  }
  if (!found.hasNextPage) break;
  page += 1;
}

console.info(`${pending.length} places without coordinates.`);

let resolved = 0;
const misses: string[] = [];
for (const place of pending) {
  let hit = await monumentParkPoint(place.sourceUrl);
  if (!hit) {
    for (const query of [...addressQueries(place.formatted), `${place.name}, Harlem, New York, NY`]) {
      hit = await geocode(query);
      if (hit) break;
    }
  }
  if (!hit) {
    misses.push(`${place.slug} (${place.name})`);
    continue;
  }
  resolved += 1;
  console.info(`${place.slug} → ${hit.point} [${hit.queryUrl}]`);
  if (APPLY) {
    await payload.update({
      collection: 'places',
      id: place.id,
      data: {
        location: hit.point,
        locationAccuracy: 'approx',
        locationSource: { url: hit.queryUrl, verifiedAt: new Date().toISOString() },
      },
      overrideAccess: true,
    });
  }
}

console.info(`${APPLY ? 'Updated' : 'Would update'} ${resolved} of ${pending.length}.`);
if (misses.length) console.info(`No geocode hit (${misses.length}): ${misses.join(', ')}`);

process.exit(0);
