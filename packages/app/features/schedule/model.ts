/**
 * Resource-major schedule model.
 *
 * The grid's columns are RESOURCES (instructors, rooms, chairs) and the date is
 * fixed — this is a day view of who is busy when, not a week view of dates.
 * That inverts the usual calendar model and is why the virtualization axis is
 * resources rather than days.
 */

/**
 * Accent families available to a resource column.
 *
 * These are palette family names from packages/theme/tokens.ts. They exist so
 * every column gets a visually distinct hue while still resolving to design
 * tokens — see accent-classes.ts for why the class strings are spelled out
 * rather than built from this value.
 */
export const RESOURCE_ACCENTS = ['ember', 'gold', 'forest', 'sky', 'rose'] as const;

export type ResourceAccent = (typeof RESOURCE_ACCENTS)[number];

export interface Resource {
  id: string;
  name: string;
  /** Remote avatar. Absent falls back to a monogram built from `name`. */
  avatarUrl?: string;
  accent: ResourceAccent;
}

export type ScheduleEventKind = 'lesson' | 'block' | 'break';

export interface ScheduleEvent {
  id: string;
  resourceId: string;
  title: string;
  /**
   * Instants, not naive local strings. A `Date` is an absolute point in time;
   * where it lands on the grid is resolved against the calendar's IANA zone by
   * `zonedMinutesOfDay`, so a schedule authored in one zone renders correctly
   * when read in another.
   */
  start: Date;
  end: Date;
  kind: ScheduleEventKind;
}

export interface ScheduleDay {
  /**
   * Instant at which `startHour` falls on the displayed date.
   *
   * Supplied by the data layer rather than derived here on purpose: going from
   * a wall-clock hour BACK to an instant requires resolving the zone offset for
   * that date, including the two days a year where a local time is ambiguous or
   * does not exist. The read direction (instant -> wall clock) is unambiguous
   * and is what `zonedMinutesOfDay` does.
   */
  dayStart: Date;
  /** IANA zone the grid is drawn in, e.g. 'America/New_York'. */
  timeZone: string;
  /** First hour rule, in wall-clock hours of `timeZone`. */
  startHour: number;
  /** Last hour rule, exclusive of the following hour's label. */
  endHour: number;
  resources: Resource[];
  events: ScheduleEvent[];
}

/**
 * Accent belongs to the RESOURCE, never to the event — Noto colours a column,
 * not an appointment. Deriving it here keeps the two from drifting apart.
 */
export function accentForEvent(
  event: ScheduleEvent,
  resources: readonly Resource[],
): ResourceAccent | undefined {
  return resources.find((resource) => resource.id === event.resourceId)?.accent;
}

const MINUTES_PER_HOUR = 60;

/**
 * Wall-clock minutes since midnight for `instant` as observed in `timeZone`.
 *
 * Uses Intl rather than a date library because Intl is the only thing in the
 * runtime that already knows the IANA database, including DST transitions.
 * `hourCycle: 'h23'` avoids the 24-vs-0 midnight ambiguity that 'h24' and the
 * default hour12 formatting both introduce.
 */
export function zonedMinutesOfDay(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);

  const read = (type: 'hour' | 'minute') => {
    const part = parts.find((candidate) => candidate.type === type);
    return part ? Number.parseInt(part.value, 10) : 0;
  };

  return read('hour') * MINUTES_PER_HOUR + read('minute');
}

/** Inclusive-start, exclusive-end overlap — touching events do not collide. */
export function eventsOverlap(a: ScheduleEvent, b: ScheduleEvent): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}
