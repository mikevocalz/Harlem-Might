import type { EventDoc, MediaDoc, PlaceDoc, StoryDoc, WalkDoc } from './docs.ts';
import type {
  AccessibilityNote,
  ArchiveItem,
  EventRecord,
  PlaceRef,
  SourceRef,
  StoryRecord,
  WalkRecord,
} from './records.ts';

// Payload returns `null` for empty optional fields; the records use absent.
const opt = <T>(value: T | null | undefined): T | undefined => (value === null ? undefined : value);

/**
 * A relationship value at depth >= 1 is the populated document. A bare id or
 * null means the target is missing (deleted, or not readable), so there is no
 * slug to link to.
 */
export const mapPlaceRef = (value: number | PlaceDoc | null | undefined): PlaceRef | undefined =>
  value && typeof value === 'object' ? { id: value.id, slug: value.slug, name: value.name } : undefined;

export const mapSources = (sources: WalkDoc['sources']): SourceRef[] =>
  (sources ?? []).map((source) => ({
    label: source.label,
    url: opt(source.url),
    accessedAt: opt(source.accessedAt),
  }));

const mapAccessibility = (value: WalkDoc['accessibility']): AccessibilityNote | undefined =>
  value?.note && value.sourceUrl
    ? { note: value.note, sourceUrl: value.sourceUrl, verifiedAt: opt(value.verifiedAt) }
    : undefined;

export const mapWalk = (doc: WalkDoc): WalkRecord => ({
  id: doc.id,
  slug: doc.slug,
  title: doc.title,
  summary: doc.summary,
  distanceMeters: doc.distanceMeters,
  durationMinutes: doc.durationMinutes,
  startDescription: doc.startDescription,
  endDescription: doc.endDescription,
  accessibility: mapAccessibility(doc.accessibility),
  stops: (doc.stops ?? []).map((stop, index) => ({
    position: index + 1,
    place: mapPlaceRef(stop.place),
    note: opt(stop.note),
  })),
  sources: mapSources(doc.sources),
  updatedAt: doc.updatedAt,
});

const isMediaWithUrl = (value: number | MediaDoc): value is MediaDoc & { url: string } =>
  typeof value === 'object' && typeof value.url === 'string' && value.url.length > 0;

/** Archive items whose image is missing are dropped: a credit with no image is not an archive item. */
const mapArchive = (archive: StoryDoc['archive']): ArchiveItem[] =>
  (archive ?? []).flatMap((item) => {
    if (!isMediaWithUrl(item.media)) return [];
    return [
      {
        url: item.media.url,
        alt: item.media.alt,
        width: opt(item.media.width),
        height: opt(item.media.height),
        caption: opt(item.caption),
        credit: item.credit,
        rights: item.rights,
        rightsHolder: opt(item.rightsHolder),
        license: opt(item.license),
        sourceUrl: opt(item.sourceUrl),
      },
    ];
  });

export const mapStory = (doc: StoryDoc): StoryRecord => ({
  id: doc.id,
  slug: doc.slug,
  title: doc.title,
  dek: opt(doc.dek),
  body: doc.body,
  author: doc.author,
  places: (doc.places ?? []).flatMap((place) => {
    const ref = mapPlaceRef(place);
    return ref ? [ref] : [];
  }),
  archive: mapArchive(doc.archive),
  sources: mapSources(doc.sources),
  publishedAt: opt(doc.publishedAt),
  updatedAt: doc.updatedAt,
});

export const mapEvent = (doc: EventDoc): EventRecord => ({
  id: doc.id,
  slug: doc.slug,
  title: doc.title,
  startsAt: doc.startsAt,
  endsAt: doc.endsAt,
  timeZone: doc.startsAt_tz,
  status: doc.lifecycle,
  place: mapPlaceRef(doc.place),
  venueName: opt(doc.venueName),
  venueUrl: opt(doc.venueUrl),
  sourceUrl: doc.sourceUrl,
  fetchedAt: doc.fetchedAt,
  lastVerifiedAt: doc.lastVerifiedAt,
  ticketUrl: opt(doc.ticketUrl),
});
