import {
  WIDGET_SCHEMA_VERSION, type WidgetInputs, type WidgetSnapshot,
  type StorySummary, type EventSummary, type PlaceSummary, type WidgetCard,
} from './contracts.ts';
import { widgetPaths } from './deep-links.ts';
import { nextStopId } from './walk-session.ts';

const HOUR = 60 * 60 * 1000;
const HARLEM_TIMEZONE = 'America/New_York';

/** Stable Harlem-local day (not the viewer's device timezone). */
export function harlemDay(instant: string): string {
  const d = new Date(instant);
  if (Number.isNaN(d.valueOf())) throw new Error('Invalid timestamp');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: HARLEM_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const value = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function sourceIsValid(url: string): boolean {
  try { return ['https:', 'http:'].includes(new URL(url).protocol); }
  catch { return false; }
}

function toTime(value: string): number {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : NaN;
}

export function chooseDailyStory(stories: readonly StorySummary[], now: string): StorySummary | null {
  const available = stories.filter(s => s.published && sourceIsValid(s.sourceUrl)
    && Number.isFinite(toTime(s.publishedAt)) && toTime(s.publishedAt) <= toTime(now))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!available.length) return null;
  // No random assignment: consistent across watch, iOS and Android for a day.
  const ordinal = Math.floor(Date.parse(`${harlemDay(now)}T12:00:00Z`) / (24 * HOUR));
  return available[ordinal % available.length] ?? null;
}

export function chooseNextEvent(events: readonly EventSummary[], now: string): EventSummary | null {
  const start = toTime(now);
  return events.filter(e => e.published && e.status === 'scheduled'
    && sourceIsValid(e.sourceUrl)
    && toTime(e.startsAt) <= start + 7 * 24 * HOUR
    && toTime(e.endsAt) > start
    && toTime(e.endsAt) > toTime(e.startsAt)
    && toTime(e.lastVerifiedAt) <= start
    && toTime(e.lastVerifiedAt) >= start - 48 * HOUR)
    .sort((a, b) => toTime(a.startsAt) - toTime(b.startsAt))[0] ?? null;
}

export function chooseSavedPlace(places: readonly PlaceSummary[], ids: readonly string[]): PlaceSummary | null {
  const saved = new Set(ids);
  return places.find(p => saved.has(p.id) && p.published && sourceIsValid(p.sourceUrl)) ?? null;
}

function dateLabel(start: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: HARLEM_TIMEZONE, weekday: 'short', hour: 'numeric', minute: '2-digit',
  }).format(new Date(start));
}

/** Projection performed in the host app / trusted API, never inside a widget process. */
export function buildWidgetSnapshot(input: WidgetInputs, now: string): WidgetSnapshot {
  const timestamp = toTime(now);
  if (!Number.isFinite(timestamp)) throw new Error('Invalid widget snapshot time');
  const story = chooseDailyStory(input.stories, now);
  const event = chooseNextEvent(input.events, now);
  const place = chooseSavedPlace(input.places, input.savedPlaceIds ?? []);
  const walk = input.activeWalk;
  let walkCard: WidgetCard | null = null;
  if (walk && (walk.status === 'active' || walk.status === 'paused')) {
    const next = nextStopId(walk);
    if (next) {
      walkCard = {
        kind: 'walk',
        title: walk.walkTitle,
        eyebrow: walk.status === 'paused' ? 'PAUSED WALK' : 'TAKE ME THERE',
        subtitle: `Stop ${walk.completedStopIds.length + 1} of ${walk.stopIds.length}`,
        path: widgetPaths.walk(walk.walkSlug),
      };
    }
  }
  return {
    schemaVersion: WIDGET_SCHEMA_VERSION, generatedAt: now,
    // Host is responsible for refreshing on content changes / active walk events.
    expiresAt: new Date(timestamp + HOUR).toISOString(),
    story: story ? {
      kind: 'story', eyebrow: 'THIS IS HARLEM', title: story.title,
      subtitle: story.dek, path: widgetPaths.story(story.slug), sourceUrl: story.sourceUrl,
    } : null,
    event: event ? {
      kind: 'event', eyebrow: 'HAPPENING IN HARLEM', title: event.title,
      subtitle: `${dateLabel(event.startsAt)} · ${event.venueName}`,
      path: widgetPaths.event(), sourceUrl: event.sourceUrl,
    } : null,
    place: place ? {
      kind: 'place', eyebrow: 'MY HARLEM', title: place.title,
      subtitle: `${place.neighborhood} · ${place.reason}`,
      path: widgetPaths.place(place.slug), sourceUrl: place.sourceUrl,
    } : null,
    walk: walkCard,
  };
}

export function selectWidgetCard(snapshot: WidgetSnapshot, kind: WidgetCard['kind']): WidgetCard | null {
  if (snapshot.schemaVersion !== WIDGET_SCHEMA_VERSION) throw new Error('Unsupported snapshot version');
  return snapshot[kind];
}
