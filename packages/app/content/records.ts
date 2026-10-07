// Plain, serialisable shapes the readers return. They hide Payload internals
// (`_status`, `_tz` siblings, unpopulated ids) so routes and client components
// depend on this contract, not on the CMS schema.

/** A link to a catalogue place. Place facts stay on the place record. */
export interface PlaceRef {
  id: number;
  slug: string;
  name: string;
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
