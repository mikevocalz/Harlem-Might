// @acme/app/content — the content-read contract for Walks, Stories and Events:
// result union, record shapes, Harlem-day helpers and the reader factory.
// No Payload import lives here (boundaries.mjs FORBID_BACKEND_DIRECT). The
// ready-to-call readers are bound to Payload in @acme/payload/server.
export { createContentReaders, LIST_LIMIT, PLACES_LIMIT } from './readers.ts';
export { createRestContentSource, restQueryString } from './rest-source.ts';
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
export type { ContentDocs, ContentQuery, ContentReaders, ContentSource, ContentWhere } from './readers.ts';
export type { EventDoc, MediaDoc, PlaceDoc, SourceDoc, StoryDoc, WalkDoc } from './docs.ts';
export { harlemDayBounds, harlemToday, isHarlemDate, HARLEM_TIME_ZONE } from './harlem-time.ts';
export { isGeneratedPlaceSlug, placeNameSlug, uniquePlaceSlug } from './place-slug.ts';
export type { ContentResult, ContentUnavailable, DetailResult, UnavailableReason } from './result.ts';
export type {
  AccessibilityNote,
  ArchiveItem,
  ArchiveRights,
  EventRecord,
  EventStatus,
  LocationAccuracy,
  PlaceKind,
  PlaceLifecycle,
  PlaceRecord,
  PlaceRef,
  SourceRef,
  StoryRecord,
  WalkRecord,
  WalkStop,
} from './records.ts';
