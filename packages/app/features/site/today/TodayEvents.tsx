import type { EventRecord } from '@acme/app/content';
import { Link, Text as SemanticText, Time } from '@acme/ui/html';
import { MightsEditorialImage, MightsHeading, MightsLocationStamp, MightsNotchCard, MightsPlaceBento, MightsText } from '@acme/ui/mights';
import { View } from '@acme/ui/tw';
import { linkPlace } from '../content/place-link.ts';
import { safeHttpUrl } from '../content/safe-url.ts';
import { checkedAt, checkedLabel, eventWhen, isStale, orderForToday, statusLabel, venueName } from './event-format.ts';

// B10. References (structure only): DICE popular events grid
// (mobbin.com/sites/sections/ccbd76d8-69e7-475e-aee0-b26795977393) and Luma
// upcoming event row (mobbin.com/screens/d57a0760-5c3a-4d4c-93fe-5037f0d7b071):
// time first, then title, venue, and one way in. Every module carries its
// source and when we last checked it. Events have no page of their own, so the
// cards are frames, not links; the links inside go to the listing and the venue.

const link = 'mights-focus text-primary underline underline-offset-4 hover:no-underline';

function EventBody({ event, featured, now }: { event: EventRecord; featured: boolean; now: Date }) {
  const status = statusLabel(event.status);
  const venue = venueName(event);
  const place = linkPlace(event.place);
  const checked = checkedAt(event);
  const venueUrl = safeHttpUrl(event.venueUrl);
  const ticketUrl = safeHttpUrl(event.ticketUrl);
  const sourceUrl = safeHttpUrl(event.sourceUrl);
  const image = event.images[0] ?? event.place?.images?.[0];
  return (
    <View className="flex flex-1 flex-col">
      {image ? (
        <View className="shrink-0 border-b border-rule-hairline">
          <MightsEditorialImage
            image={image}
            screenId={`today-${event.slug}`}
            ratio={featured ? 'wide' : 'standard'}
            sizes={featured ? '(min-width: 768px) 58vw, 100vw' : '(min-width: 768px) 33vw, 100vw'}
            priority={featured}
          />
        </View>
      ) : null}
      <View className="flex flex-1 flex-col gap-3 p-5">
        <MightsText size="small" tone="default" className="font-semibold">
          {status ? `${status}. ` : ''}
          <Time dateTime={event.startsAt}>{eventWhen(event)}</Time>
        </MightsText>
        <MightsHeading level={2} size={featured ? 'title' : 'card'} className={status ? 'line-through decoration-1' : ''}>
          {event.title}
        </MightsHeading>
        {venue ? (
          place ? (
            <MightsLocationStamp name={venue} street={place.preview.street} href={place.href} className="self-start" />
          ) : venueUrl ? (
            <MightsText size="small">
              <Link href={venueUrl} className={link}>
                {venue}
              </Link>
            </MightsText>
          ) : (
            <MightsText size="small">{venue}</MightsText>
          )
        ) : null}
        <View className="mt-auto flex flex-col gap-1 pt-2">
          <MightsText size="small">
            {ticketUrl && event.status === 'scheduled' ? (
              <>
                <Link href={ticketUrl} className={link}>
                  Tickets<SemanticText className="sr-only"> for {event.title}</SemanticText>
                </Link>
                {sourceUrl ? ', ' : null}
              </>
            ) : null}
            {/* sourceUrl is required, so an unsafe one is a bad record: show no link rather than a broken one. */}
            {sourceUrl ? (
              <Link href={sourceUrl} className={link}>
                Venue listing<SemanticText className="sr-only"> for {event.title}</SemanticText>
              </Link>
            ) : null}
          </MightsText>
          <MightsText size="small">
            <Time dateTime={checked}>{checkedLabel(checked, now)}</Time>
            {isStale(checked, now) ? '. Confirm with the venue before you go.' : '.'}
          </MightsText>
        </View>
      </View>
    </View>
  );
}

export function TodayEvents({ events, now }: { events: readonly EventRecord[]; now: Date }) {
  const ordered = orderForToday(events);
  // One event is a single card; a bento needs something to be dominant over.
  if (ordered.length < 2) {
    const only = ordered[0];
    if (!only) return null;
    return (
      <MightsNotchCard className="max-w-content-screen">
        <EventBody event={only} featured now={now} />
      </MightsNotchCard>
    );
  }
  return (
    <MightsPlaceBento
      headingLevel={2}
      motionKey="today"
      modules={ordered.map((event, i) => ({
        kind: 'custom' as const,
        id: String(event.id),
        content: <EventBody event={event} featured={i === 0} now={now} />,
      }))}
    />
  );
}
