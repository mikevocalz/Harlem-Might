/**
 * Reads the Harlem Might catalogue from the same public Payload REST API the
 * mobile app uses (packages/app/content/rest-source.ts and readers.ts): same
 * collections, published-only filters, sort orders and field names. Anonymous
 * GETs only; Payload's read access serves published documents to anyone.
 */

/** A photo with an absolute URL, its pixel size, and the credit line the mobile card shows. */
export type ContentImage = { url: string; width: number; height: number; alt: string; credit?: string };

export type ContentPlace = {
  id: string; name: string; category: string; street: string; area: string; summary: string;
  latitude: number | null; longitude: number | null; image: ContentImage | null;
};
export type ContentWalk = {
  id: string; title: string; summary: string; facts: string; firstStop: ContentPlace | null;
  image: ContentImage | null;
  startDescription: string; endDescription: string;
  stops: { name: string; street: string; note: string }[];
};
export type ContentStory = {
  id: string; title: string; dek: string; author: string; image: ContentImage | null;
  publishedAt: string; updatedAt: string; body: string[];
};
export type ContentArtist = {
  id: string; name: string; genre: string; era: string; shortBio: string;
  connection: string; biography: string[];
  songTitle: string; youtubeUrl: string | null;
  /** Stored CMS headshot when the mobile policy allows it; else filled from the photo service. */
  image: ContentImage | null;
  albumArt: ContentImage | null;
};
export type ContentEvent = {
  id: string; title: string; startsAt: string; endsAt: string; venue: string; lifecycle: string;
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
      ...select("slug", "name", "primaryCategory", "primaryArea", "summary", "location", "address", "images"),
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
      startDescription: (doc.startDescription ?? "").trim(),
      endDescription: (doc.endDescription ?? "").trim(),
      stops: (Array.isArray(doc.stops) ? doc.stops : []).map((stop: any) => {
        const place = stop?.place && typeof stop.place === "object" ? toPlace(stop.place, this.origin()) : null;
        return {
          name: place?.name || "This stop is no longer in the catalogue",
          street: place ? place.street || place.area : "",
          note: stop?.note ?? "",
        };
      }),
    }));
  }

  async stories(): Promise<ContentStory[]> {
    const docs = await this.docs("stories", [published(), "depth=1", "limit=100", "sort=-publishedAt"]);
    return docs.map((doc) => ({
      id: String(doc.id), title: doc.title ?? "", dek: doc.dek ?? "", author: doc.author ?? "",
      // Same order as the mobile story card (storyPhotos): own images, then
      // the linked places' photos, then archive art.
      image: firstImage([
        ...(doc.images ?? []),
        ...(doc.places ?? []).flatMap((place: any) => (typeof place === "object" ? place?.images ?? [] : [])),
        ...(doc.archive ?? []).map((item: any) => item?.media),
      ], this.origin()),
      publishedAt: doc.publishedAt ?? "",
      updatedAt: doc.updatedAt ?? "",
      body: storyParagraphs(doc.body ?? ""),
    }));
  }

  async musicArtists(page: number): Promise<{ artists: ContentArtist[]; hasNextPage: boolean }> {
    const body = await this.body("music-artists", [
      published(), "depth=1", "limit=24", "sort=name,id", "page=" + page,
    ]);
    return {
      hasNextPage: Boolean(body.hasNextPage),
      // Published records whose bio is still the seed placeholder are hidden on
      // Specs; hasNextPage still follows Payload's paging.
      artists: (body.docs ?? []).filter((doc: any) => !isPlaceholderBio(doc)).map((doc: any) => ({
        id: String(doc.id),
        name: doc.name ?? "",
        genre: doc.genre ?? "",
        era: doc.era ?? "",
        shortBio: doc.shortBio ?? "",
        connection: musicConnectionLabel(doc.connection),
        biography: biographyParagraphs(doc.biography ?? ""),
        songTitle: doc.featuredSong?.title ?? "",
        youtubeUrl: doc.featuredSong?.youtubeUrl ?? null,
        // The mobile app never uses album art as a portrait.
        image: shouldUseStoredArtistPhoto(doc.name ?? "", doc.headshot)
          ? toImage(doc.headshot, this.origin(), creditLine(doc.headshot)) : null,
        albumArt: toImage(doc.albumArt, this.origin()),
      })),
    };
  }

  /**
   * Portraits for artists without a usable stored headshot, from the site's
   * /api/music/artist-photo service, exactly as artist-photo-client.ts asks.
   */
  async artistPhotos(names: string[]): Promise<Record<string, ContentImage | null>> {
    const result: Record<string, ContentImage | null> = {};
    if (names.length === 0) return result;
    const url = this.origin() + "/api/music/artist-photo?v=" + ARTIST_PHOTO_VERSION
      + "&names=" + encodeURIComponent(names.join("|"));
    const body = await this.fetchJson(url);
    for (const name of names) {
      const photo = body?.photos?.[name];
      result[name] = photo && typeof photo.url === "string" ? {
        url: photo.url, width: Number(photo.width) || 0, height: Number(photo.height) || 0,
        alt: name + " artist photo",
        credit: [photo.credit, providerLabel(photo.provider), photo.license || "external reference"]
          .filter(Boolean).join(" \u00b7 "),
      } : null;
    }
    return result;
  }

  // Today: events overlapping today in New York, like the app's Today view;
  // when today is empty, the next 90 days, like its Upcoming view.
  async todayEvents(now: Date): Promise<{ events: ContentEvent[]; upcoming: boolean }> {
    const [start, end] = newYorkDay(now);
    let events = await this.events(start, end);
    // Today view lists scheduled events first (orderForToday on mobile).
    if (events.length > 0) {
      const scheduled = events.filter((e) => e.lifecycle === "scheduled");
      return { events: scheduled.concat(events.filter((e) => e.lifecycle !== "scheduled")), upcoming: false };
    }
    events = await this.events(start, new Date(start.getTime() + 90 * DAY_MS));
    return { events, upcoming: true };
  }

  private async events(start: Date, end: Date): Promise<ContentEvent[]> {
    const docs = await this.docs("events", [
      "where[and][0][_status][equals]=published",
      "where[and][1][startsAt][less_than]=" + encodeURIComponent(end.toISOString()),
      "where[and][2][endsAt][greater_than]=" + encodeURIComponent(start.toISOString()),
      // depth 2 so the venue's images arrive populated for the image fallback.
      "depth=2", "limit=24", "sort=startsAt,id",
    ]);
    return docs.map((doc) => ({
      id: String(doc.id),
      title: doc.title ?? "",
      startsAt: doc.startsAt ?? "",
      endsAt: doc.endsAt ?? doc.startsAt ?? "",
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

function toImage(media: any, origin: string, credit?: string): ContentImage | null {
  if (!media || typeof media !== "object" || typeof media.url !== "string" || !media.url) return null;
  const url = /^https?:\/\//.test(media.url) ? media.url : origin + (media.url.startsWith("/") ? "" : "/") + media.url;
  return { url, width: Number(media.width) || 0, height: Number(media.height) || 0, alt: media.alt ?? "", credit };
}

// Music rules ported from packages/app/features/music (artist-photo-policy.ts,
// artist-photo.ts, music-format.ts) so Specs shows the same portraits and copy.
const ARTIST_PHOTO_VERSION = "6";
const REJECTED_STORED_SOURCES: Record<string, string> = {
  "Black Ivory": "https://commons.wikimedia.org/wiki/File:Black_Ivory_first_promo_picture.jpg",
  "Dizzy Gillespie": "https://commons.wikimedia.org/wiki/File:(Portrait_of_Dizzy_Gillespie,_New_York,_N.Y.,_between_1946_and_1948)_(LOC)_(4976469817).jpg",
  "Frankie Cutlass": "https://commons.wikimedia.org/wiki/File:Victor_Cruz_And_Frankie_Cutlass.jpg",
  "Harlem Gospel Choir": "https://commons.wikimedia.org/wiki/File:ArtFund_Promo_Photo_Credit_Yvonnetnt.jpg",
  "J. Rosamond Johnson": "https://commons.wikimedia.org/wiki/File:Coleandjohnson.jpg",
};

function sourceIdentity(value: string): string {
  const match = /^https?:\/\/([^/?#]+)([^?#]*)/i.exec(value);
  if (!match) return value;
  let path = match[2];
  try { path = decodeURIComponent(path); } catch (error) { /* keep as is */ }
  return match[1].toLowerCase() + path.replace(/_/g, " ");
}

export function shouldUseStoredArtistPhoto(name: string, headshot: any): boolean {
  if (!headshot || typeof headshot !== "object") return false;
  const rejected = REJECTED_STORED_SOURCES[name];
  return !rejected || sourceIdentity(headshot.sourceUrl ?? "") !== sourceIdentity(rejected);
}

function creditLine(media: any): string {
  return [media?.credit, media?.license].filter(Boolean).join(" \u00b7 ");
}

function providerLabel(provider: string): string {
  return provider === "wikimedia_commons" ? "Wikimedia Commons"
    : provider === "curated_web" ? "Verified artist source" : "";
}

export function musicConnectionLabel(connection: string): string {
  switch (connection) {
    case "born-raised": return "Born or raised in Harlem";
    case "resident": return "Harlem resident";
    case "scene": return "Harlem music-scene figure";
    case "east-harlem": return "East Harlem / El Barrio";
    default: return "";
  }
}

/** The plain-text biography as paragraphs (blank-line separated in the CMS). */
export function biographyParagraphs(biography: string): string[] {
  return biography.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

function toPlace(doc: any, origin: string): ContentPlace {
  // Payload stores points as [longitude, latitude].
  const point = Array.isArray(doc.location) && doc.location.length === 2 ? doc.location : null;
  return {
    id: String(doc.id),
    name: doc.name ?? "",
    category: doc.primaryCategory || "Community",
    street: streetOf(doc.address?.formatted ?? ""),
    area: doc.primaryArea || "Harlem",
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

function firstImage(media: any[], origin: string): ContentImage | null {
  for (const item of media) {
    const image = toImage(item, origin);
    if (image) return image;
  }
  return null;
}

/** Story body as paragraphs, like storyParagraphs in story-format.ts. */
export function storyParagraphs(body: string): string[] {
  return body.split(/\r?\n\s*\r?\n/).map((p) => p.replace(/\s*\r?\n\s*/g, " ").trim()).filter((p) => p.length > 0);
}

/** Explore row line, placeRowLine in explore-copy.ts: "Culture, 253 West 125th Street". */
export function placeRowLine(place: ContentPlace): string {
  return place.category + ", " + (place.street || place.area) + (place.latitude === null ? ", location pending" : "");
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
  "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Wall-clock parts in New York for an instant.
function newYorkParts(date: Date): { y: number; mo: number; d: number; wd: number; h: number; mi: number } {
  const local = new Date(date.getTime() - (isEasternDaylightTime(date) ? 4 : 5) * 3600 * 1000);
  return { y: local.getUTCFullYear(), mo: local.getUTCMonth(), d: local.getUTCDate(), wd: local.getUTCDay(),
    h: local.getUTCHours(), mi: local.getUTCMinutes() };
}

function clock(h: number, mi: number, withPeriod: boolean): string {
  return ((h + 11) % 12 + 1) + ":" + (mi < 10 ? "0" : "") + mi + (withPeriod ? (h < 12 ? " AM" : " PM") : "");
}

/**
 * When an event runs, like eventWhen in event-format.ts: same-day events show
 * times only ("7:30 – 10:00 PM"); multi-day runs add dates; Upcoming adds the year.
 */
export function formatEventWhen(startIso: string, endIso: string, showDate = false): string {
  const start = new Date(startIso);
  const end = new Date(endIso || startIso);
  if (isNaN(start.getTime())) return "";
  const a = newYorkParts(start);
  const b = newYorkParts(isNaN(end.getTime()) ? start : end);
  const sameDay = a.y === b.y && a.mo === b.mo && a.d === b.d;
  const date = (p: typeof a) => MONTHS_SHORT[p.mo] + " " + p.d + (showDate ? ", " + p.y : "");
  if (sameDay) {
    // Intl's formatRange drops the shared AM/PM: "7:30 – 10:00 PM".
    const prefix = showDate ? date(a) + ", " : "";
    if (a.h === b.h && a.mi === b.mi) return prefix + clock(a.h, a.mi, true);
    const samePeriod = (a.h < 12) === (b.h < 12);
    return prefix + clock(a.h, a.mi, !samePeriod) + " \u2013 " + clock(b.h, b.mi, true);
  }
  return date(a) + ", " + clock(a.h, a.mi, true) + " \u2013 " + date(b) + ", " + clock(b.h, b.mi, true);
}

/** "Oct 3, 2026" in New York, like storyDate in story-format.ts. */
export function formatStoryDate(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  const p = newYorkParts(date);
  return MONTHS_SHORT[p.mo] + " " + p.d + ", " + p.y;
}

/** "Friday, October 9th" in New York, like todayHeading in event-format.ts. */
export function todayHeading(now: Date): string {
  const p = newYorkParts(now);
  const n = p.d;
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
  return WEEKDAYS[p.wd] + ", " + MONTHS_LONG[p.mo] + " " + n + suffix;
}

const PLACEHOLDER_BIO = /^editorial candidate pending verification/i;

/** The seed text left on unverified artists ("Editorial candidate pending verification…"). */
export function isPlaceholderBio(doc: { shortBio?: string; biography?: string }): boolean {
  return PLACEHOLDER_BIO.test((doc.shortBio ?? "").trim()) || PLACEHOLDER_BIO.test((doc.biography ?? "").trim());
}
