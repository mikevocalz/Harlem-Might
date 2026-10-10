import { getPayload } from 'payload';
import { uniquePlaceSlug } from '@acme/app/content';
import { NTA_CODES, containingNta, fetchNtaBoundaries, type Nta } from './nta.ts';
import config from './payload.config';
import type { Place } from './payload-types';

// NYC Open Data place enrichment, on top of the OSM import in seed-places.ts.
// Both sources are keyless and carry official coordinates or clear geography:
//
//   - buis-pvji  LPC Individual Landmark Sites: named landmarks with parcel
//                centroids and the designation-report PDF as the source.
//   - 6rrm-vxj9  NYC Parks Monuments: statues/memorials with no coordinates —
//                they import with locationAccuracy 'pending' under their park.
//
// `pnpm seed:places-nyc` previews; `--apply` inserts new slugs only.

const LANDMARKS_URL = `https://data.cityofnewyork.us/resource/buis-pvji.json?${new URLSearchParams({
  $where: `nta2020 in(${NTA_CODES.map((c) => `'${c}'`).join(',')})`,
  $limit: '5000',
})}`;
const MONUMENTS_URL = `https://data.cityofnewyork.us/resource/6rrm-vxj9.json?${new URLSearchParams({
  $where: "borough='Manhattan' AND commboard in(9,10,11)",
  $limit: '5000',
})}`;

type PlaceData = Pick<Place, 'name' | 'slug' | 'kind' | 'lifecycle' | 'locationAccuracy'> &
  Partial<Pick<Place, 'primaryCategory' | 'primaryArea' | 'summary' | 'location' | 'locationSource' | 'dataQuality' | 'address' | 'legacySlugs'>>;

type LandmarkRow = {
  objectid?: string;
  lpc_name?: string;
  lpc_altern?: string;
  address?: string;
  borough?: string;
  lpc_sitede?: string;
  landmarkty?: string;
  url_report?: string;
  latitude?: string;
  longitude?: string;
  nta2020?: string;
};

type MonumentRow = {
  number?: string;
  name?: string;
  fileorder?: string;
  parkname?: string;
  location?: string;
  descrip?: string;
  categories?: string;
  dedicated?: string;
  borough?: string;
};

async function fetchJson<T>(url: string): Promise<T> {
  const token = process.env.NYC_OPEN_DATA_APP_TOKEN;
  const run = (headers: HeadersInit) => fetch(url, { signal: AbortSignal.timeout(90_000), headers });
  let response = await run(token ? { 'X-App-Token': token } : {});
  if (!response.ok && token) response = await run({});
  if (!response.ok) throw new Error(`Source request failed (${response.status}): ${new URL(url).host}`);
  return (await response.json()) as T;
}

function landmarks(rows: LandmarkRow[], ntas: Nta[]): PlaceData[] {
  return rows.flatMap((row) => {
    const name = row.lpc_name?.trim();
    const lat = parseFloat(row.latitude ?? '');
    const lon = parseFloat(row.longitude ?? '');
    if (!row.objectid || !name || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    const area = containingNta([lon, lat], ntas);
    if (!area) return [];
    return [
      {
        name,
        slug: `lpc-${row.objectid}`,
        legacySlugs: [{ slug: `lpc-${row.objectid}` }],
        kind: 'historic' as const,
        lifecycle: 'unknown' as const,
        primaryCategory: row.landmarkty === 'Interior Landmark' ? 'Culture' : 'History',
        primaryArea: area.properties.ntaname,
        summary: row.lpc_sitede?.trim() || undefined,
        location: [lon, lat],
        locationAccuracy: 'approx' as const,
        locationSource: { url: row.url_report ?? `https://data.cityofnewyork.us/resource/buis-pvji.json?objectid=${row.objectid}` },
        dataQuality: { state: 'unverified' as const },
        address: row.address ? { formatted: `${row.address}, ${row.borough ?? 'Manhattan'}, NY` } : undefined,
      },
    ];
  });
}

function monuments(rows: MonumentRow[]): PlaceData[] {
  return rows.flatMap((row) => {
    const name = row.name?.trim();
    if (!row.number || !name) return [];
    const where = [row.location?.trim(), row.parkname?.trim()].filter(Boolean).join(', ');
    return [
      {
        name,
        slug: `mon-${row.number}`,
        legacySlugs: [{ slug: `mon-${row.number}` }],
        kind: 'historic' as const,
        lifecycle: 'unknown' as const,
        primaryCategory: 'History',
        primaryArea: row.parkname?.trim() ?? 'Manhattan',
        summary: row.descrip?.trim() || row.categories?.trim() || undefined,
        // No coordinates in the feed: pending, never approximated.
        locationAccuracy: 'pending' as const,
        locationSource: { url: `https://data.cityofnewyork.us/resource/6rrm-vxj9.json?number=${row.number}` },
        dataQuality: { state: 'unverified' as const },
        address: where ? { formatted: `${where}, New York, NY` } : undefined,
      },
    ];
  });
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to import places.');
const apply = process.argv.includes('--apply');
const [ntas, landmarkRows, monumentRows] = await Promise.all([
  fetchNtaBoundaries(),
  fetchJson<LandmarkRow[]>(LANDMARKS_URL),
  fetchJson<MonumentRow[]>(MONUMENTS_URL),
]);
const landmarkPlaces = landmarks(landmarkRows, ntas);
const monumentPlaces = monuments(monumentRows);
const inputs = new Map<string, PlaceData>();
for (const data of [...landmarkPlaces, ...monumentPlaces]) {
  // The feed id stays in locationSource; the canonical path is the name.
  const slug = uniquePlaceSlug(data.name, new Set(inputs.keys()), data.slug);
  inputs.set(slug, { ...data, slug });
}

const payload = await getPayload({ config });
const slugs = [...inputs.keys()];
const existing = new Set<string>();
const existingNames = new Set<string>();
for (let page = 1; ; page++) {
  const result = await payload.find({ collection: 'places', limit: 100, page, depth: 0, overrideAccess: true });
  result.docs.forEach((doc) => {
    existing.add(doc.slug);
    existingNames.add(doc.name.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
  });
  if (!result.hasNextPage) break;
}
// A landmark row duplicating a catalogued name (the Apollo's LPC record vs the
// curated place) would fork the canonical record — the existing one wins.
const missing = slugs.filter((slug) => {
  const data = inputs.get(slug);
  return !existing.has(slug) && !(data && existingNames.has(data.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '')));
});

console.info(
  `LPC landmarks ${landmarkRows.length} rows → ${landmarkPlaces.length} inside the Harlem NTAs; ` +
    `Parks monuments ${monumentRows.length} rows → ${monumentPlaces.length}. ` +
    `Total candidates ${slugs.length}; existing ${slugs.length - missing.length}; new ${missing.length}.`,
);
if (!apply) {
  console.info(
    `Preview only; pass --apply to insert. Sample: ${missing
      .slice(0, 15)
      .map((slug) => `${inputs.get(slug)?.name} [${inputs.get(slug)?.primaryArea}]`)
      .join('; ')}`,
  );
} else {
  for (const slug of missing) {
    await payload.create({ collection: 'places', overrideAccess: true, data: inputs.get(slug)! });
    console.info(`Created ${slug}`);
  }
  console.info(`Created ${missing.length} places; existing records unchanged.`);
}
