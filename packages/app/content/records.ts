import type { EditorialImage } from '@acme/assets';

// Plain, serialisable shapes the readers return. They hide Payload internals
// (`_status`, `_tz` siblings, unpopulated ids) so routes and client components
// depend on this contract, not on the CMS schema.

/** A link to a catalogue place. Place facts stay on the place record. */
export interface PlaceRef {
  id: number;
  slug: string;
  name: string;
  /** Present only when populated media passed the rights/provenance gate. */
  images?: EditorialImage[];
  /** `[lng, lat]`, when the place has a map point; cards render it as a satellite image. */
  lngLat?: readonly [number, number];
}

export type PlaceKind = 'business' | 'culture' | 'historic' | 'outdoors' | 'public-art' | 'community';

export type PlaceLifecycle =
  | 'open'
  | 'temporarily_closed'
  | 'seasonal'
  | 'permanently_closed'
  | 'historical_only'
  | 'unknown';

export type LocationAccuracy = 'verified' | 'approx' | 'pending';

/** A catalogue place. `unknown`/`pending`/`unverified` fields pass through, never dressed up. */
export interface PlaceRecord {
  id: number;
  slug: string;
  name: string;
  kind: PlaceKind;
  lifecycle: PlaceLifecycle;
  category?: string;
  area?: string;
  summary?: string;
  /** WGS84 [lng, lat]; absent while `locationAccuracy` is 'pending'. */
  location?: readonly [number, number];
  locationAccuracy: LocationAccuracy;
  /** Source the point was read from (e.g. an openstreetmap.org object URL). */
  locationSourceUrl?: string;
  /** ISO instant the point's source was last read. */
  locationSourceReadAt?: string;
  /** Formatted postal address when the record carries one. */
  address?: string;
  website?: string;
  phone?: string;
  /** Hours exactly as the source published them; `osm` is the raw opening_hours value. */
  openingHours?: { osm?: string; note?: string; sourceUrl?: string; verifiedAt?: string };
  /** Official menu links (web/PDF); only rows still marked active. */
  menus?: { label: string; url?: string; sourceUrl?: string; mealPeriod?: string }[];
  /** Curator-picked landmark. */
  featured: boolean;
  images: EditorialImage[];
}

/** One citation from a record's `sources` list. */
export interface SourceRef {
  label: string;
  url?: string;
  /** ISO instant the source was last read. */
  accessedAt?: string;
}

/** A sourced accessibility note on a walk. Absent when no source exists. */
export interface AccessibilityNote {
  note: string;
  sourceUrl: string;
  /** ISO instant. */
  verifiedAt?: string;
}

export interface WalkStop {
  /** 1-based position in walking order. */
  position: number;
  /**
   * The stop's place. `undefined` when the place record was deleted after the
   * walk was published; render the stop without a link rather than hiding it,
   * so the stop count stays truthful.
   */
  place?: PlaceRef;
  note?: string;
}

export interface WalkRecord {
  id: number;
  slug: string;
  title: string;
  summary: string;
  distanceMeters: number;
  durationMinutes: number;
  startDescription: string;
  endDescription: string;
  accessibility?: AccessibilityNote;
  images: EditorialImage[];
  stops: WalkStop[];
  sources: SourceRef[];
  /** ISO instant. */
  updatedAt: string;
}

export type ArchiveRights = 'owned' | 'licensed' | 'venue_supplied' | 'open_license' | 'public_domain';

/** An archival or commissioned image attached to a story, with its credit. */
export interface ArchiveItem {
  url: string;
  alt: string;
  width?: number;
  height?: number;
  caption?: string;
  credit: string;
  rights: ArchiveRights;
  rightsHolder?: string;
  license?: string;
  sourceUrl?: string;
}

export interface StoryRecord {
  id: number;
  slug: string;
  title: string;
  dek?: string;
  /** Plain text; paragraphs separated by blank lines. */
  body: string;
  author: string;
  places: PlaceRef[];
  images: EditorialImage[];
  archive: ArchiveItem[];
  sources: SourceRef[];
  /** ISO instant. */
  publishedAt?: string;
  /** ISO instant. */
  updatedAt: string;
}

export type EventStatus = 'scheduled' | 'cancelled' | 'postponed';

/**
 * A sourced listing. Cancelled and postponed events are returned so the page
 * can label them; the page decides whether to show them.
 */
export interface EventRecord {
  id: number;
  slug: string;
  title: string;
  /** ISO instant (UTC). Format with `timeZone`. */
  startsAt: string;
  /** ISO instant (UTC). */
  endsAt: string;
  /** IANA zone the times were entered in. Always America/New_York today. */
  timeZone: string;
  status: EventStatus;
  images: EditorialImage[];
  /** The catalogue venue, when the venue is in Places. */
  place?: PlaceRef;
  /** Venue name when the venue is not catalogued. */
  venueName?: string;
  venueUrl?: string;
  sourceUrl: string;
  /** ISO instant the listing was first read. */
  fetchedAt: string;
  /** ISO instant someone last confirmed the listing. */
  lastVerifiedAt: string;
  ticketUrl?: string;
}
