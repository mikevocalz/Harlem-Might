// @acme/app/content — the content-read contract for Walks, Stories and Events:
// result union, record shapes, Harlem-day helpers and the reader factory.
// No Payload import lives here (boundaries.mjs FORBID_BACKEND_DIRECT). The
// ready-to-call readers are bound to Payload in @acme/payload/server.
export { createContentReaders, LIST_LIMIT } from './readers.ts';
export type { ContentDocs, ContentQuery, ContentReaders, ContentSource, ContentWhere } from './readers.ts';
export type { EventDoc, MediaDoc, PlaceDoc, SourceDoc, StoryDoc, WalkDoc } from './docs.ts';
export { harlemDayBounds, harlemToday, isHarlemDate, HARLEM_TIME_ZONE } from './harlem-time.ts';
export type { ContentResult, ContentUnavailable, DetailResult, UnavailableReason } from './result.ts';
export type {
  AccessibilityNote,
  ArchiveItem,
  ArchiveRights,
  EventRecord,
  EventStatus,
  PlaceRef,
  SourceRef,
  StoryRecord,
  WalkRecord,
  WalkStop,
} from './records.ts';
