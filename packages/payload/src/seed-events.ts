import { getPayload } from 'payload';
import { containingNta, fetchNtaBoundaries, type Nta, type Point } from './nta.ts';
import config from './payload.config';
import type { Event } from './payload-types';

// Harlem events from sources that need no key, both refreshed daily by the
// city. Everything lands as a draft: Events is `publishedOrCurator`, so a
// curator publishes after checking the listing — imports never go straight
// to the site.
//
//   OSM_PBF not needed. `pnpm seed:events` previews; `--apply` writes drafts.

// NYC Parks public events, next 14 days. Carries coordinates, so rows clip
// to the same Harlem NTA polygons as the places import.
const PARKS_URL = 'https://data.cityofnewyork.us/resource/w3wp-dpdi.json?$limit=5000';
// Approved street and park permits for roughly the next month. The
// community_board column is a comma-joined list ("10, 11,"), so Manhattan
// rows are fetched whole and filtered here.
const PERMITS_URL = 'https://data.cityofnewyork.us/resource/tvpp-9vvx.json?event_borough=Manhattan&$limit=50000';
// CB9 Manhattanville/Hamilton Heights, CB10 Central Harlem, CB11 East Harlem —
// the same coverage the NTA codes draw.
const HARLEM_BOARDS = new Set([9, 10, 11]);
const NY_TZ = 'America/New_York';
// Credentialed providers can't query an NTA, so they fetch a radius around
// Harlem's centre and each row still has to land inside the polygons.
const HARLEM_CENTRE = { lat: 40.815, lon: -73.945 };
const QUERY_RADIUS_MILES = 3;
// Providers that don't return an end time get a 3-hour placeholder so the
// draft validates; a curator corrects it before anything is published.
const ESTIMATED_DURATION_MS = 3 * 60 * 60 * 1000;

type EventData = Pick<
  Event,
  'title' | 'slug' | 'lifecycle' | 'startsAt' | 'endsAt' | 'startsAt_tz' | 'endsAt_tz' | 'sourceUrl' | 'fetchedAt' | 'lastVerifiedAt'
> &
  Partial<Pick<Event, 'place' | 'venueName' | 'venueUrl' | 'ticketUrl'>>;

type ParksRow = {
  title?: string;
  guid?: string;
  link?: { url?: string };
  parknames?: string;
  starttime?: string;
  endtime?: string;
  location?: string;
  categories?: string;
  coordinates?: string;
  registration_url?: { url?: string };
};

type PermitRow = {
  event_id?: string;
  event_name?: string;
  start_date_time?: string;
  end_date_time?: string;
  event_type?: string;
  event_location?: string;
  community_board?: string;
};

type TicketmasterRow = {
  id?: string;
  name?: string;
  url?: string;
  dates?: {
    start?: { dateTime?: string; localDate?: string; localTime?: string };
    end?: { dateTime?: string };
  };
  _embedded?: { venues?: { name?: string; url?: string; location?: { latitude?: string; longitude?: string } }[] };
};

type SeatgeekRow = {
  id?: number;
  title?: string;
  url?: string;
  datetime_utc?: string;
  enddatetime_utc?: string;
  venue?: { name?: string; url?: string; location?: { lat?: number; lon?: number } };
};

type PredicthqRow = {
  id?: string;
  title?: string;
  start?: string;
  end?: string;
  location?: [number, number];
  entities?: { formatted_address?: string; name?: string }[];
};

/** Socrata date-times are New York wall time without a zone; convert to a UTC ISO instant. */
function nyLocalToUtc(local: string): string | undefined {
  const guess = new Date(`${local}Z`);
  if (Number.isNaN(guess.getTime())) return undefined;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: NY_TZ,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(guess)
      .map((p) => [p.type, p.value]),
  );
  const asNy = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) === 24 ? 0 : Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return new Date(guess.getTime() - (asNy - guess.getTime())).toISOString();
}

// Feeds publish HTML entities in titles and venues (&#8217;, &nbsp;).
const HTML_ENTITIES: Record<string, string> = {
  amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"',
};
function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&(\w+);/g, (m, name) => HTML_ENTITIES[name] ?? m)
    .trim();
}

/** Parks prefix "CANCELED: X" / "POSTPONED: X"; permits keep the flag in the name too. */
function lifecycleOf(title: string): { lifecycle: Event['lifecycle']; title: string } {
  const match = /^(cancell?ed|postponed)\s*[:\-–—]\s*(.+)$/i.exec(title);
  if (!match) return { lifecycle: 'scheduled', title };
  const lifecycle = match[1]!.toLowerCase().startsWith('postponed') ? 'postponed' : 'cancelled';
  return { lifecycle, title: match[2]! };
}

function boardsOf(value: string | undefined): number[] {
  return (value ?? '')
    .split(',')
    .map((token) => parseInt(token.trim(), 10))
    .filter((n) => Number.isFinite(n));
}

/** "lat, lon" text to a [lng, lat] point. */
function parksPoint(coordinates: string | undefined): Point | undefined {
  const [lat, lon] = (coordinates ?? '').split(',').map((s) => parseFloat(s.trim()));
  return lat !== undefined && lon !== undefined && Number.isFinite(lat) && Number.isFinite(lon) ? [lon, lat] : undefined;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(90_000), ...init });
  if (!response.ok) throw new Error(`Source request failed (${response.status}): ${new URL(url).host}`);
  return (await response.json()) as T;
}

/** Socrata throttles anonymous callers; the optional app token raises the cap.
 *  A stale token returns 403, so fall back to anonymous rather than failing. */
async function fetchSocrata<T>(url: string): Promise<T> {
  const token = process.env.NYC_OPEN_DATA_APP_TOKEN;
  if (!token) return fetchJson<T>(url);
  try {
    return await fetchJson<T>(url, { headers: { 'X-App-Token': token } });
  } catch (error) {
    console.warn(`NYC Open Data app token rejected (${error instanceof Error ? error.message : String(error)}); retrying anonymously.`);
    return fetchJson<T>(url);
  }
}

/** end > start, or fall back to the estimate constant. */
function endOrEstimate(startsAt: string, endsAt: string | undefined): string | undefined {
  if (endsAt && new Date(endsAt) > new Date(startsAt)) return endsAt;
  return new Date(new Date(startsAt).getTime() + ESTIMATED_DURATION_MS).toISOString();
}

function parksEvents(rows: ParksRow[], ntas: Nta[], fetchedAt: string): EventData[] {
  return rows.flatMap((row) => {
    const point = parksPoint(row.coordinates);
    if (!row.guid || !row.title || !row.starttime || !row.endtime || !row.link?.url) return [];
    if (!point || !containingNta(point, ntas)) return [];
    const startsAt = nyLocalToUtc(row.starttime);
    const endsAt = nyLocalToUtc(row.endtime);
    if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) return [];
    const status = lifecycleOf(decodeEntities(row.title));
    return [
      {
        title: status.title,
        slug: `parks-${row.guid}`,
        lifecycle: status.lifecycle,
        startsAt,
        endsAt,
        startsAt_tz: NY_TZ,
        endsAt_tz: NY_TZ,
        venueName: decodeEntities(row.location ?? row.parknames ?? 'NYC Parks'),
        venueUrl: row.link.url,
        sourceUrl: row.link.url,
        ticketUrl: row.registration_url?.url,
        fetchedAt,
        lastVerifiedAt: fetchedAt,
      },
    ];
  });
}

function ticketmasterEvents(rows: TicketmasterRow[], ntas: Nta[], fetchedAt: string): EventData[] {
  return rows.flatMap((row) => {
    if (!row.id || !row.name || !row.url) return [];
    const venue = row._embedded?.venues?.[0];
    const lat = parseFloat(venue?.location?.latitude ?? '');
    const lon = parseFloat(venue?.location?.longitude ?? '');
    if (!venue?.name || !Number.isFinite(lat) || !Number.isFinite(lon) || !containingNta([lon, lat], ntas)) return [];
    const startsAt = row.dates?.start?.dateTime ?? nyLocalToUtc(`${row.dates?.start?.localDate}T${row.dates?.start?.localTime ?? '00:00:00'}`);
    if (!startsAt || Number.isNaN(new Date(startsAt).getTime())) return [];
    const endsAt = endOrEstimate(startsAt, row.dates?.end?.dateTime);
    if (!endsAt) return [];
    return [
      {
        title: decodeEntities(row.name),
        slug: `tm-${row.id}`,
        lifecycle: 'scheduled' as const,
        startsAt,
        endsAt,
        startsAt_tz: NY_TZ,
        endsAt_tz: NY_TZ,
        venueName: decodeEntities(venue.name),
        venueUrl: venue.url,
        sourceUrl: row.url,
        ticketUrl: row.url,
        fetchedAt,
        lastVerifiedAt: fetchedAt,
      },
    ];
  });
}

function seatgeekEvents(rows: SeatgeekRow[], ntas: Nta[], fetchedAt: string): EventData[] {
  return rows.flatMap((row) => {
    if (!row.id || !row.title || !row.url || !row.datetime_utc) return [];
    const lat = row.venue?.location?.lat;
    const lon = row.venue?.location?.lon;
    if (!row.venue?.name || lat === undefined || lon === undefined || !containingNta([lon, lat], ntas)) return [];
    const startsAt = new Date(row.datetime_utc).toISOString();
    const endsAt = endOrEstimate(startsAt, row.enddatetime_utc ? new Date(row.enddatetime_utc).toISOString() : undefined);
    if (!endsAt) return [];
    return [
      {
        title: decodeEntities(row.title),
        slug: `sg-${row.id}`,
        lifecycle: 'scheduled' as const,
        startsAt,
        endsAt,
        startsAt_tz: NY_TZ,
        endsAt_tz: NY_TZ,
        venueName: decodeEntities(row.venue.name),
        venueUrl: row.venue.url,
        sourceUrl: row.url,
        ticketUrl: row.url,
        fetchedAt,
        lastVerifiedAt: fetchedAt,
      },
    ];
  });
}

function predicthqEvents(rows: PredicthqRow[], ntas: Nta[], fetchedAt: string): EventData[] {
  return rows.flatMap((row) => {
    if (!row.id || !row.title || !row.start || !row.end) return [];
    if (!row.location || !containingNta(row.location, ntas)) return [];
    const venueName = row.entities?.[0]?.name ?? row.entities?.[0]?.formatted_address;
    if (!venueName) return [];
    const startsAt = new Date(row.start).toISOString();
    const endsAt = new Date(row.end).toISOString();
    if (new Date(endsAt) <= new Date(startsAt)) return [];
    return [
      {
        title: decodeEntities(row.title),
        slug: `phq-${row.id}`,
        lifecycle: 'scheduled' as const,
        startsAt,
        endsAt,
        startsAt_tz: NY_TZ,
        endsAt_tz: NY_TZ,
        venueName,
        sourceUrl: `https://control.predicthq.com/search/events/${row.id}`,
        fetchedAt,
        lastVerifiedAt: fetchedAt,
      },
    ];
  });
}

type CredentialedProvider = {
  name: string;
  key: string | undefined;
  fetch: (key: string) => Promise<EventData[]>;
};

function credentialedProviders(ntas: Nta[], fetchedAt: string): CredentialedProvider[] {
  return [
    {
      name: 'ticketmaster',
      key: process.env.TICKETMASTER_API_KEY,
      fetch: async (apikey) =>
        ticketmasterEvents(
          (
            await fetchJson<{ _embedded?: { events?: TicketmasterRow[] } }>(
              `https://app.ticketmaster.com/discovery/v2/events.json?${new URLSearchParams({
                apikey,
                latlong: `${HARLEM_CENTRE.lat},${HARLEM_CENTRE.lon}`,
                radius: String(QUERY_RADIUS_MILES),
                unit: 'miles',
                size: '200',
                sort: 'date,asc',
              })}`,
            )
          )._embedded?.events ?? [],
          ntas,
          fetchedAt,
        ),
    },
    {
      name: 'seatgeek',
      key: process.env.SEATGEEK_CLIENT_ID,
      fetch: async (client_id) =>
        seatgeekEvents(
          (
            await fetchJson<{ events?: SeatgeekRow[] }>(
              `https://api.seatgeek.com/2/events?${new URLSearchParams({
                client_id,
                lat: String(HARLEM_CENTRE.lat),
                lon: String(HARLEM_CENTRE.lon),
                range: `${QUERY_RADIUS_MILES}mi`,
                per_page: '200',
              })}`,
            )
          ).events ?? [],
          ntas,
          fetchedAt,
        ),
    },
    {
      name: 'predicthq',
      key: process.env.PREDICTHQ_API_TOKEN,
      fetch: async (token) =>
        predicthqEvents(
          (
            await fetchJson<{ results?: PredicthqRow[] }>(
              `https://api.predicthq.com/v1/events/?${new URLSearchParams({
                'location.within': `${QUERY_RADIUS_MILES}mi@${HARLEM_CENTRE.lat},${HARLEM_CENTRE.lon}`,
                limit: '200',
              })}`,
              { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
            )
          ).results ?? [],
          ntas,
          fetchedAt,
        ),
    },
  ];
}

function permitEvents(rows: PermitRow[], fetchedAt: string): EventData[] {
  return rows.flatMap((row) => {
    if (!row.event_id || !row.event_name || !row.start_date_time || !row.end_date_time || !row.event_location) return [];
    if (!boardsOf(row.community_board).some((board) => HARLEM_BOARDS.has(board))) return [];
    const startsAt = nyLocalToUtc(row.start_date_time);
    const endsAt = nyLocalToUtc(row.end_date_time);
    if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) return [];
    const status = lifecycleOf(decodeEntities(row.event_name));
    return [
      {
        title: status.title,
        slug: `permit-${row.event_id}`,
        lifecycle: status.lifecycle,
        startsAt,
        endsAt,
        startsAt_tz: NY_TZ,
        endsAt_tz: NY_TZ,
        venueName: decodeEntities(row.event_location),
        sourceUrl: `https://data.cityofnewyork.us/resource/tvpp-9vvx.json?event_id=${row.event_id}`,
        fetchedAt,
        lastVerifiedAt: fetchedAt,
      },
    ];
  });
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to import events.');
const apply = process.argv.includes('--apply');
const fetchedAt = new Date().toISOString();

const ntas = await fetchNtaBoundaries();
const [parksRows, permitRows] = await Promise.all([fetchSocrata<ParksRow[]>(PARKS_URL), fetchSocrata<PermitRow[]>(PERMITS_URL)]);
const parks = parksEvents(parksRows, ntas, fetchedAt);
const permits = permitEvents(permitRows, fetchedAt);

// EVENTS_PROVIDERS_ENABLED is a comma list; empty means every adapter whose
// credentials are present, matching packages/config/src/env.server.ts.
const enabledNames = (process.env.EVENTS_PROVIDERS_ENABLED ?? '')
  .split(',')
  .map((name) => name.trim().toLowerCase())
  .filter(Boolean);
const credentialed: { name: string; events: EventData[] }[] = [];
for (const provider of credentialedProviders(ntas, fetchedAt)) {
  if (enabledNames.length && !enabledNames.includes(provider.name)) continue;
  if (!provider.key) {
    console.info(`Skipping ${provider.name}: no credential.`);
    continue;
  }
  try {
    const events = await provider.fetch(provider.key);
    credentialed.push({ name: provider.name, events });
    console.info(`${provider.name}: ${events.length} events inside the Harlem NTAs.`);
  } catch (error) {
    console.warn(`${provider.name} failed (${error instanceof Error ? error.message : String(error)}); continuing without it.`);
  }
}
const inputs = new Map<string, EventData>();
for (const data of [...parks, ...permits, ...credentialed.flatMap((p) => p.events)]) {
  if (!inputs.has(data.slug)) inputs.set(data.slug, data);
}

const payload = await getPayload({ config });
const slugs = [...inputs.keys()];
const existing = new Set<string>();
for (let page = 1; ; page++) {
  const result = await payload.find({ collection: 'events', limit: 100, page, depth: 0, overrideAccess: true, draft: true });
  result.docs.forEach((doc) => existing.add(doc.slug));
  if (!result.hasNextPage) break;
}
const missing = slugs.filter((slug) => !existing.has(slug));

console.info(
  `Sources: NYC Parks upcoming events ${parksRows.length} rows → ${parks.length} inside the Harlem NTAs; NYC permitted events ${permitRows.length} Manhattan rows → ${permits.length} in community boards 9/10/11` +
    `${credentialed.map((p) => `; ${p.name} → ${p.events.length}`).join('')}. ` +
    `Total candidates ${slugs.length}; existing ${slugs.length - missing.length}; new ${missing.length}.`,
);
if (!apply) {
  console.info(
    `Preview only; pass --apply to create drafts. Sample: ${missing
      .slice(0, 15)
      .map((slug) => `${inputs.get(slug)?.title} (${inputs.get(slug)?.venueName})`)
      .join('; ')}`,
  );
} else {
  for (const slug of missing) {
    await payload.create({ collection: 'events', overrideAccess: true, draft: true, data: inputs.get(slug)! });
    console.info(`Created draft ${slug}`);
  }
  console.info(`Created ${missing.length} draft events; existing records unchanged. They publish from /admin after a curator check.`);
}
