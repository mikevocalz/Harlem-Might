import type { EventRecord, EventStatus } from '@acme/app/content';

// Pure formatting for /today. Every clock and calendar read here runs in the
// event's own zone (America/New_York), never the server's UTC day.

const HARLEM = 'America/New_York';

function dayKey(iso: string | Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    typeof iso === 'string' ? new Date(iso) : iso,
  );
  return parts; // en-CA formats as YYYY-MM-DD
}

/**
 * When an event runs. Same-day events show times only ("7:30 – 10:00 PM");
 * multi-day runs show the dates too ("Oct 5, 7:30 PM – Oct 12, 10:00 PM").
 */
export function eventWhen(event: Pick<EventRecord, 'startsAt' | 'endsAt' | 'timeZone'>): string {
  const timeZone = event.timeZone || HARLEM;
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const sameDay = dayKey(start, timeZone) === dayKey(end, timeZone);
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone,
    ...(sameDay ? {} : { month: 'short', day: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
  });
  return format.formatRange(start, end);
}

/**
 * The instant a listing was last confirmed: the later of first fetch and last
 * verification, so the label never understates how fresh it is.
 */
export function checkedAt(event: Pick<EventRecord, 'fetchedAt' | 'lastVerifiedAt'>): string {
  return new Date(event.lastVerifiedAt).getTime() >= new Date(event.fetchedAt).getTime()
    ? event.lastVerifiedAt
    : event.fetchedAt;
}

/** "Checked today at 3:10 PM", "Checked Oct 5", "Checked Dec 30, 2025". */
export function checkedLabel(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  if (dayKey(at, HARLEM) === dayKey(now, HARLEM)) {
    const time = new Intl.DateTimeFormat('en-US', { timeZone: HARLEM, hour: 'numeric', minute: '2-digit' }).format(at);
    return `Checked today at ${time}`;
  }
  const sameYear = dayKey(at, HARLEM).slice(0, 4) === dayKey(now, HARLEM).slice(0, 4);
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone: HARLEM,
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(at);
  return `Checked ${date}`;
}

/** English ordinal suffix: 1st, 2nd, 3rd, 4th … 21st, 22nd, 23rd, 24th. */
export function ordinalDay(day: number): string {
  const tens = day % 100;
  if (tens >= 11 && tens <= 13) return `${day}th`;
  return `${day}${['th', 'st', 'nd', 'rd'][day % 10] ?? 'th'}`;
}

const todayHeadingParts = new Intl.DateTimeFormat('en-US', {
  timeZone: HARLEM,
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

/**
 * The /today page heading date, US order with the ordinal: "Friday, October
 * 9th". Shared by the web page and the mobile TodayScreen so the two never
 * drift back to day-first.
 */
export function todayHeading(now: Date): string {
  const parts = Object.fromEntries(todayHeadingParts.formatToParts(now).map((p) => [p.type, p.value]));
  return `${parts.weekday}, ${parts.month} ${ordinalDay(Number(parts.day))}`;
}

/** Listings older than this get a "confirm with the venue" line. */
export const STALE_AFTER_DAYS = 7;

export function isStale(iso: string, now: Date = new Date(), days = STALE_AFTER_DAYS): boolean {
  return now.getTime() - new Date(iso).getTime() > days * 24 * 60 * 60 * 1000;
}

const STATUS_LABEL: Record<EventStatus, string | null> = {
  scheduled: null,
  cancelled: 'Cancelled',
  postponed: 'Postponed',
};

/** Visible status for anything that is not running as listed. */
export const statusLabel = (status: EventStatus) => STATUS_LABEL[status];

/**
 * Running events first, in start order (the readers already sort by start);
 * cancelled and postponed ones after, so the dominant B10 module is always an
 * event someone can go to.
 */
export function orderForToday<T extends Pick<EventRecord, 'status'>>(events: readonly T[]): T[] {
  return [...events.filter((e) => e.status === 'scheduled'), ...events.filter((e) => e.status !== 'scheduled')];
}

/** The venue line: the catalogue name when the venue is a place, else the listing's name. */
export function venueName(event: Pick<EventRecord, 'place' | 'venueName'>): string | null {
  return event.place?.name ?? event.venueName ?? null;
}
