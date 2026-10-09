import { NextResponse } from 'next/server';
import { listStories, listEventsForDate, harlemToday } from '@acme/payload/server';
import { buildWidgetSnapshot, type EventSummary, type StorySummary } from '@acme/widgets';

/**
 * Read-only, curated public feed. Never returns member identities, auth
 * sessions, saved private locations, or unpublished CMS documents.
 */
export async function GET(): Promise<NextResponse> {
  const now = new Date().toISOString();
  const day = harlemToday(new Date(now));
  const [stories, events] = await Promise.all([listStories(), listEventsForDate(day)]);
  if (stories.status !== 'ok' || events.status !== 'ok') {
    return NextResponse.json(
      { error: 'The Harlem Might editorial feed is temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const storySummaries: StorySummary[] = stories.data.map((story) => ({
    id: String(story.id),
    slug: story.slug,
    title: story.title,
    dek: story.dek ?? '',
    published: true, // published-only reader with access control
    sourceUrl: story.sources.find((source) => source.url)?.url ?? '',
    publishedAt: story.publishedAt ?? story.updatedAt,
  }));
  const eventSummaries: EventSummary[] = events.data.map((event) => ({
    id: String(event.id),
    title: event.title,
    venueName: event.place?.name ?? event.venueName ?? 'Venue information pending',
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    status: event.status,
    published: true,
    sourceUrl: event.sourceUrl,
    lastVerifiedAt: event.lastVerifiedAt,
  }));
  const snapshot = buildWidgetSnapshot({
    stories: storySummaries,
    events: eventSummaries,
    places: [], // Never serve account-specific saved places on a public endpoint.
    activeWalk: null, // Walk session is explicitly supplied on the member's device.
  }, now);
  return NextResponse.json(snapshot, {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' },
  });
}
