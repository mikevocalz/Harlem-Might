/**
 * Public, bounded, versioned data contract for native widgets, watch surfaces,
 * and the web/mobile handoff. Never include credentials, precise live location,
 * private member details, unreviewed drafts, or full CMS bodies here.
 */
export const WIDGET_SCHEMA_VERSION = 1 as const;
export type WidgetKind = 'story' | 'event' | 'place' | 'walk';
export type WalkStatus = 'active' | 'paused' | 'completed';

export interface PlaceSummary {
  id: string;
  slug: string;
  title: string;
  neighborhood: string;
  reason: string;
  published: boolean;
  sourceUrl: string;
  verifiedAt: string;
}

export interface StorySummary {
  id: string;
  slug: string;
  title: string;
  dek: string;
  published: boolean;
  sourceUrl: string;
  publishedAt: string;
}

export interface EventSummary {
  id: string;
  title: string;
  venueName: string;
  startsAt: string; // ISO UTC instant
  endsAt: string;
  status: 'scheduled' | 'cancelled' | 'postponed';
  published: boolean;
  sourceUrl: string;
  lastVerifiedAt: string;
}

export interface WalkSummary {
  id: string;
  slug: string;
  title: string;
  stopIds: readonly string[];
  published: boolean;
  sourceUrl: string;
}

export interface WalkSession {
  schemaVersion: typeof WIDGET_SCHEMA_VERSION;
  sessionId: string;
  walkId: string;
  walkSlug: string;
  walkTitle: string;
  stopIds: readonly string[];
  /** Ordered prefix of confirmed stops, never location-derived speculation. */
  completedStopIds: readonly string[];
  status: WalkStatus;
  revision: number;
  startedAt: string;
  updatedAt: string;
}

export interface WidgetCard {
  kind: WidgetKind;
  title: string;
  subtitle: string;
  eyebrow: string;
  /** In-app URL path, not an unaudited external destination. */
  path: string;
  /** This is not proof a venue is currently open, or that an event has tickets. */
  sourceUrl?: string;
}

export interface WidgetSnapshot {
  schemaVersion: typeof WIDGET_SCHEMA_VERSION;
  generatedAt: string;
  expiresAt: string;
  story: WidgetCard | null;
  event: WidgetCard | null;
  place: WidgetCard | null;
  walk: WidgetCard | null;
}

export interface WidgetInputs {
  stories: readonly StorySummary[];
  events: readonly EventSummary[];
  places: readonly PlaceSummary[];
  activeWalk?: WalkSession | null;
  /** Caller supplies saved canonical PLACE ids, not fixture slugs. */
  savedPlaceIds?: readonly string[];
}
