/**
 * Reads the Harlem Might catalogue from the same public Payload REST API the
 * mobile app uses (packages/app/content/rest-source.ts and readers.ts): same
 * collections, published-only filters, sort orders and field names. Anonymous
 * GETs only; Payload's read access serves published documents to anyone.
 */

/** A CMS photo with an absolute URL and its pixel size, when Payload has it. */
export type ContentImage = { url: string; width: number; height: number; alt: string };

export type ContentPlace = {
  id: string; name: string; category: string; street: string; summary: string;
  latitude: number | null; longitude: number | null; image: ContentImage | null;
};
export type ContentWalk = {
  id: string; title: string; summary: string; facts: string; firstStop: ContentPlace | null;
  image: ContentImage | null;
};
export type ContentStory = { id: string; title: string; dek: string; author: string; image: ContentImage | null };
export type ContentArtist = {
  id: string; name: string; genre: string; era: string; shortBio: string;
  songTitle: string; youtubeUrl: string | null; image: ContentImage | null;
};
export type ContentEvent = {
  id: string; title: string; startsAt: string; venue: string; lifecycle: string;
  image: ContentImage | null;
};

type Fetcher = (url: string) => Promise<any>;

export class HarlemMightContent {
  private readonly apiBase: string;
  private readonly fetchJson: Fetcher;

  constructor(apiBase: string, fetchJson: Fetcher) {
    this.apiBase = apiBase;
    this.fetchJson = fetchJson;
  }

  // Explore: the mobile catalogue lists all ~1,700 places by name with search.
  // Without a keyboard the Specs list starts from the curated featured set.
  async featuredPlaces(): Promise<ContentPlace[]> {
    const docs = await this.docs("places", [
      "where[featured][equals]=true", "depth=1", "limit=24", "sort=name",
      ...select("slug", "name", "primaryCategory", "summary", "location", "address", "images"),
    ]);
    return docs.map((doc) => toPlace(doc, this.origin()));
  }

  async walks(): Promise<ContentWalk[]> {
    const docs = await this.docs("walks", [published(), "depth=1", "limit=100", "sort=-updatedAt"]);
    return docs.map((doc) => ({
      id: String(doc.id),
      title: doc.title ?? "",
      summary: doc.summary ?? "",
      facts: walkFacts(doc),
      firstStop: doc.stops?.[0]?.place && typeof doc.stops[0].place === "object"
        ? toPlace(doc.stops[0].place, this.origin()) : null,
      image: toImage(doc.images?.[0], this.origin()),
    }));
  }

  async stories(): Promise<ContentStory[]> {
    const docs = await this.docs("stories", [published(), "depth=1", "limit=100", "sort=-publishedAt"]);
    return docs.map((doc) => ({
      id: String(doc.id), title: doc.title ?? "", dek: doc.dek ?? "", author: doc.author ?? "",
      // Same order as the mobile story card: own images, then archive art.
      image: toImage(doc.images?.[0], this.origin()) ?? toImage(doc.archive?.[0]?.media, this.origin()),
    }));
  }

  async musicArtists(page: number): Promise<{ artists: ContentArtist[]; hasNextPage: boolean }> {
    const body = await this.body("music-artists", [
      published(), "depth=1", "limit=24", "sort=name,id", "page=" + page,
    ]);
    return {
      hasNextPage: Boolean(body.hasNextPage),
      artists: (body.docs ?? []).map((doc: any) => ({
        id: String(doc.id),
        name: doc.name ?? "",
        genre: doc.genre ?? "",
        era: doc.era ?? "",
        shortBio: doc.shortBio ?? "",
        songTitle: doc.featuredSong?.title ?? "",
        youtubeUrl: doc.featuredSong?.youtubeUrl ?? null,
        // CMS headshot only; the mobile app never uses album art as a portrait.
        image: toImage(doc.headshot, this.origin()),
      })),
    };
  }

  // Today: events overlapping today in New York, like the app's Today view;
  // when today is empty, the next 90 days, like its Upcoming view.
  async todayEvents(now: Date): Promise<{ events: ContentEvent[]; upcoming: boolean }> {
    const [start, end] = newYorkDay(now);
    let events = await this.events(start, end);
    if (events.length > 0) return { events, upcoming: false };
    events = await this.events(start, new Date(start.getTime() + 90 * DAY_MS));
    return { events, upcoming: true };
  }

  private async events(start: Date, end: Date): Promise<ContentEvent[]> {
    const docs = await this.docs("events", [
      "where[and][0][_status][equals]=published",
      "where[and][1][startsAt][less_than]=" + encodeURIComponent(end.toISOString()),
      "where[and][2][endsAt][greater_than]=" + encodeURIComponent(start.toISOString()),
      "depth=1", "limit=24", "sort=startsAt,id",
    ]);
    return docs.map((doc) => ({
      id: String(doc.id),
      title: doc.title ?? "",
      startsAt: doc.startsAt ?? "",
      venue: (typeof doc.place === "object" && doc.place?.name) || doc.venueName || "",
      lifecycle: doc.lifecycle ?? "scheduled",
      // The event's own image, else its venue's, as on the mobile event card.
      image: toImage(doc.images?.[0], this.origin())
        ?? (typeof doc.place === "object" ? toImage(doc.place?.images?.[0], this.origin()) : null),
    }));
  }

  // Media URLs are often relative ("/payload-api/media/file/..."); they resolve
  // against the API's origin, as in packages/app/content/editorial-images.ts.
  private origin(): string {
    const match = /^(https?:\/\/[^/]+)/.exec(this.apiBase);
    return match ? match[1] : "";
  }

  private async docs(collection: string, params: string[]): Promise<any[]> {
    return (await this.body(collection, params)).docs ?? [];
  }

  private async body(collection: string, params: string[]): Promise<any> {
    const url = this.apiBase.replace(/\/+$/, "") + "/" + collection + "?" + [...params, "draft=false"].join("&");
    return this.fetchJson(url);
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

function published(): string {
  return "where[_status][equals]=published";
}

function select(...fields: string[]): string[] {
  return fields.map((field) => "select[" + field + "]=true");
}

function toImage(media: any, origin: string): ContentImage | null {
  if (!media || typeof media !== "object" || typeof media.url !== "string" || !media.url) return null;
  const url = /^https?:\/\//.test(media.url) ? media.url : origin + (media.url.startsWith("/") ? "" : "/") + media.url;
  return { url, width: Number(media.width) || 0, height: Number(media.height) || 0, alt: media.alt ?? "" };
}

function toPlace(doc: any, origin: string): ContentPlace {
  // Payload stores points as [longitude, latitude].
  const point = Array.isArray(doc.location) && doc.location.length === 2 ? doc.location : null;
  return {
    id: String(doc.id),
    name: doc.name ?? "",
    category: doc.primaryCategory || "Community",
    street: streetOf(doc.address?.formatted ?? ""),
    summary: doc.summary ?? "",
    latitude: point ? Number(point[1]) : null,
    longitude: point ? Number(point[0]) : null,
    image: toImage(doc.images?.[0], origin),
  };
}

// Same rule as packages/app/features/explore/catalogue.ts: the first address
// segment is the street.
function streetOf(formatted: string): string {
  return formatted.split(",")[0]?.trim() ?? "";
}

// Same line as the mobile walk card, walkSummaryLine() in
// packages/app/features/site/walks/walk-facts.ts: "1.2 miles, 45 min, 6 stops".
function walkFacts(doc: any): string {
  const parts: string[] = [];
  const meters = Number(doc.distanceMeters);
  if (isFinite(meters) && meters > 0) {
    const miles = Math.max(0.1, Math.round((meters / 1609.344) * 10) / 10);
    parts.push(miles + (miles === 1 ? " mile" : " miles"));
  }
  const minutes = Math.round(Number(doc.durationMinutes));
  if (isFinite(minutes) && minutes > 0) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    parts.push(hours === 0 ? rest + " min" : rest === 0 ? hours + " hr" : hours + " hr " + rest + " min");
  }
  const stops = Array.isArray(doc.stops) ? doc.stops.length : 0;
  if (stops > 0) parts.push(stops + (stops === 1 ? " stop" : " stops"));
  return parts.join(", ");
}

// [start, end) of the current New York calendar day as UTC instants. Lens
// runtimes don't ship Intl time zones, so this applies the US Eastern DST rule.
export function newYorkDay(now: Date): [Date, Date] {
  const offsetHours = isEasternDaylightTime(now) ? 4 : 5;
  const local = new Date(now.getTime() - offsetHours * 3600 * 1000);
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + offsetHours * 3600 * 1000;
  return [new Date(start), new Date(start + DAY_MS)];
}

// DST runs from the second Sunday of March 2:00 to the first Sunday of
// November 2:00 local time.
function isEasternDaylightTime(now: Date): boolean {
  const year = now.getUTCFullYear();
  const nthSunday = (month: number, n: number) => {
    const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
    return 1 + ((7 - first) % 7) + (n - 1) * 7;
  };
  const start = Date.UTC(year, 2, nthSunday(2, 2), 7);
  const end = Date.UTC(year, 10, nthSunday(10, 1), 6);
  return now.getTime() >= start && now.getTime() < end;
}

/** "Thu Oct 15 · 10:00 AM" in New York time. */
export function formatEventTime(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  const offset = isEasternDaylightTime(date) ? 4 : 5;
  const local = new Date(date.getTime() - offset * 3600 * 1000);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const h = local.getUTCHours();
  const m = local.getUTCMinutes();
  const time = ((h + 11) % 12 + 1) + ":" + (m < 10 ? "0" : "") + m + (h < 12 ? " AM" : " PM");
  return days[local.getUTCDay()] + " " + months[local.getUTCMonth()] + " " + local.getUTCDate() + " · " + time;
}
