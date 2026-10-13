// @acme/app/content — the content-read contract for Walks, Stories and Events:
// result union, record shapes, Harlem-day helpers and the reader factory.
// No Payload import lives here (boundaries.mjs FORBID_BACKEND_DIRECT). The
// ready-to-call readers are bound to Payload in @acme/payload/server.
export { createContentReaders, EVENT_RANGE_DAYS, EVENTS_PAGE_SIZE, LIST_LIMIT, MUSIC_PAGE_SIZE, PLACES_LIMIT } from './readers.ts';
export { createRestContentSource, restQueryString } from './rest-source.ts';
export { contentFetch } from './content-fetch.ts';
export { contentQuery, contentQueryResult, ContentQueryError } from './result.ts';
export { HARLEM_HISTORY_FACTS, harlemHistoryFactFor } from './history-facts.ts';
export type { HarlemHistoryFact } from './history-facts.ts';
export type { ContentFetch, RestContentSourceOptions } from './rest-source.ts';
export {
  HARLEM_ARCHIVAL_IMAGES,
  getHarlemArchivalImage,
  isDisplayableEditorialImage,
  mapEditorialImages,
} from './editorial-images.ts';
export type { EditorialImage } from './editorial-images.ts';
export type {
  ContentDocs,
  ContentDocument,
  ContentPage,
  ContentQuery,
  ContentReaders,
  ContentRequestOptions,
  ContentSelect,
  ContentSource,
  ContentWhere,
  EventPage,
  MusicArtistPage,
} from './readers.ts';
export type { EventDoc, MediaDoc, MusicArtistDoc, PlaceDoc, SourceDoc, StoryDoc, WalkDoc } from './docs.ts';
export { addHarlemDays, harlemDayBounds, harlemToday, isHarlemDate, HARLEM_TIME_ZONE } from './harlem-time.ts';
export { isGeneratedPlaceSlug, placeNameSlug, uniquePlaceSlug } from './place-slug.ts';
export type { ContentResult, ContentUnavailable, DetailResult, UnavailableReason } from './result.ts';
export type {
  AccessibilityNote,
  ArchiveItem,
  ArchiveRights,
  EventRecord,
  EventStatus,
  FeaturedSongRef,
  LocationAccuracy,
  MusicArtistRecord,
  MusicConnection,
  PlaceKind,
  PlaceLifecycle,
  PlaceRecord,
  PlaceRef,
  SourceRef,
  SpatialTrackRef,
  StoryRecord,
  WalkRecord,
  WalkStop,
} from './records.ts';
