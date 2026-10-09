import { getPayload } from 'payload';
import config from './payload.config';
import type { Walk } from './payload-types';

// Draft walks over the featured catalogue places. Distance and duration are
// computed live with Mapbox walking directions between the actual stops —
// the numbers are real routing, not editorial guesses. Everything lands as
// a draft for a curator to voice and publish.
//
// `pnpm seed:walks` previews; `--apply` inserts new slugs only.
// Requires NEXT_PUBLIC_MAPBOX_TOKEN (the same key the web map uses).

const WALKS: { title: string; slug: string; summary: string; stops: string[]; notes?: Record<string, string> }[] = [
  {
    title: '125th Street Icons',
    slug: 'walk-125th-street-icons',
    summary: 'Harlem’s main artery in one sweep — the Apollo’s marquee, the Studio Museum’s new home, and the National Black Theatre, finished at Red Rooster for the meal the street earned.',
    stops: ['apollo-theater', 'studio-museum-harlem', 'national-black-theatre', 'red-rooster-harlem'],
  },
  {
    title: 'Mount Morris Heritage Loop',
    slug: 'walk-mount-morris-heritage',
    summary: 'From the brownstone blocks of Strivers’ Row to the park Harlem still calls Mount Morris, closing at Sylvia’s — the anchor of Lenox Avenue since 1962.',
    stops: ['strivers-row', 'marcus-garvey-park', 'sylvias-restaurant'],
  },
  {
    title: 'Lenox Avenue Culture Circuit',
    slug: 'walk-lenox-culture-circuit',
    summary: 'The Schomburg’s archives, the elegant rows of Strivers’ Row, and dinner at Sylvia’s — a Lenox Avenue line through Harlem’s memory and its table.',
    stops: ['schomburg-center', 'strivers-row', 'sylvias-restaurant'],
  },
];

const STOP_PADDING_MINUTES = 10;

type Stop = { id: number; name: string; lngLat: [number, number] };

async function walkingRoute(points: [number, number][], token: string): Promise<{ distance: number; duration: number } | undefined> {
  const coords = points.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/walking/${coords}?${new URLSearchParams({ access_token: token, overview: 'false' })}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    console.warn(`Mapbox directions failed (${response.status}); distance/duration will need manual entry.`);
    return undefined;
  }
  const json = (await response.json()) as { routes?: { distance?: number; duration?: number }[] };
  const route = json.routes?.[0];
  return route?.distance !== undefined && route?.duration !== undefined ? { distance: route.distance, duration: route.duration } : undefined;
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to import walks.');
const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
if (!mapboxToken) throw new Error('NEXT_PUBLIC_MAPBOX_TOKEN is required to compute walk distances.');
const apply = process.argv.includes('--apply');
const payload = await getPayload({ config });

const placesBySlug = new Map<string, Stop>();
for (let page = 1; ; page++) {
  const result = await payload.find({ collection: 'places', limit: 100, page, depth: 0, overrideAccess: true });
  result.docs.forEach((doc) => {
    const location = doc.location as [number, number] | null | undefined;
    if (Array.isArray(location) && location.length === 2) placesBySlug.set(doc.slug, { id: doc.id, name: doc.name, lngLat: location });
  });
  if (!result.hasNextPage) break;
}

const existing = new Set<string>();
for (let page = 1; ; page++) {
  const result = await payload.find({ collection: 'walks', limit: 100, page, depth: 0, overrideAccess: true, draft: true });
  result.docs.forEach((doc) => existing.add(doc.slug));
  if (!result.hasNextPage) break;
}

const accessedAt = new Date().toISOString();
const walks: { slug: string; data: Record<string, unknown> }[] = [];
for (const walk of WALKS) {
  if (existing.has(walk.slug)) continue;
  const stops = walk.stops.map((slug) => placesBySlug.get(slug));
  if (stops.some((s) => !s)) {
    console.warn(`Skipping ${walk.slug}: missing stops ${walk.stops.filter((s, i) => !stops[i]).join(', ')}.`);
    continue;
  }
  const located = stops as Stop[];
  const route = await walkingRoute(located.map((s) => s.lngLat), mapboxToken);
  if (!route) continue;
  const distanceMeters = Math.round(route.distance);
  const durationMinutes = Math.round(route.duration / 60) + located.length * STOP_PADDING_MINUTES;
  walks.push({
    slug: walk.slug,
    data: {
      title: walk.title,
      slug: walk.slug,
      summary: walk.summary,
      stops: located.map((stop) => ({ place: stop.id, note: walk.notes?.[stop.name] })),
      distanceMeters,
      durationMinutes,
      startDescription: `Start at ${located[0]!.name}.`,
      endDescription: `Finish at ${located.at(-1)!.name}.`,
      sources: [
        { label: 'Catalogue place records (OpenStreetMap / LPC / NYC Parks provenance)', accessedAt },
        { label: 'Mapbox Directions API — walking profile', url: 'https://docs.mapbox.com/api/navigation/directions/', accessedAt },
      ],
    },
  });
  console.info(`${walk.slug}: ${located.length} stops, ${distanceMeters}m routed, ~${durationMinutes}min.`);
}

console.info(`Walks planned ${WALKS.length}; existing ${existing.size}; new drafts ${walks.length}.`);
if (!apply) {
  console.info('Preview only; pass --apply to create drafts.');
} else {
  for (const walk of walks) {
    await payload.create({ collection: 'walks', overrideAccess: true, draft: true, data: walk.data as unknown as Walk });
    console.info(`Created draft walk ${walk.slug}`);
  }
  console.info(`Created ${walks.length} draft walks; they publish from /admin after editorial review.`);
}
