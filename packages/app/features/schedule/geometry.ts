import type { LaidOutEvent } from './lanes.ts';
import { zonedMinutesOfDay, type ScheduleDay } from './model.ts';

/**
 * Grid geometry.
 *
 * This module is the whole of the "computed geometry" exception to the
 * Tailwind-only rule: it returns NUMBERS for position and size only. It never
 * produces a colour, radius, border or spacing value — those stay in classes.
 */

export const MINUTES_PER_HOUR = 60;

/**
 * Vertical room past the last hour rule so its label is not clipped by the
 * body's own height. Rules and events keep their absolute offsets, so adding
 * this moves nothing — it only stops the final label being cut in half.
 */
export const HOUR_LABEL_TAIL = 24;

/** Half an hour-label's line box, to centre it ON the rule rather than under it. */
export const HOUR_LABEL_OFFSET = 6;

/** Left time-label gutter. */
export const TIME_GUTTER_WIDTH = 64;

/** One resource column. Below this two lines of event text stop fitting. */
export const RESOURCE_COLUMN_WIDTH = 184;

/** Below this a block cannot show two lines of text, so it stops shrinking. */
export const MIN_EVENT_HEIGHT = 24;

/** Hairline gutter between concurrent lanes, as a fraction of column width. */
const LANE_GAP_FRACTION = 0.02;

export interface EventRect {
  top: number;
  height: number;
  /** Fraction of the column width, 0–1. */
  leftFraction: number;
  widthFraction: number;
}

/** Vertical offset in px of a wall-clock minute-of-day within the grid. */
export function offsetForMinutes(
  minutesOfDay: number,
  day: Pick<ScheduleDay, 'startHour'>,
  hourHeight: number,
): number {
  return ((minutesOfDay - day.startHour * MINUTES_PER_HOUR) / MINUTES_PER_HOUR) * hourHeight;
}

/**
 * Position and size for one laid-out event.
 *
 * Height is clamped, so a 5-minute appointment stays legible instead of
 * collapsing to a sliver — the clamp is applied to height only, never to `top`,
 * because moving the block would misreport when it starts.
 */
export function eventRect(
  laidOut: LaidOutEvent,
  day: Pick<ScheduleDay, 'startHour' | 'timeZone'>,
  hourHeight: number,
): EventRect {
  const { event, lane, laneCount } = laidOut;

  const startMinutes = zonedMinutesOfDay(event.start, day.timeZone);
  const endMinutes = zonedMinutesOfDay(event.end, day.timeZone);

  const top = offsetForMinutes(startMinutes, day, hourHeight);
  const rawHeight = ((endMinutes - startMinutes) / MINUTES_PER_HOUR) * hourHeight;

  const laneWidth = 1 / laneCount;
  const gap = laneCount > 1 ? LANE_GAP_FRACTION : 0;

  return {
    top,
    height: Math.max(rawHeight, MIN_EVENT_HEIGHT),
    leftFraction: lane * laneWidth,
    widthFraction: laneWidth - gap,
  };
}

/** Total scrollable height of the grid body. */
export function gridHeight(
  day: Pick<ScheduleDay, 'startHour' | 'endHour'>,
  hourHeight: number,
): number {
  return (day.endHour - day.startHour) * hourHeight;
}

/** Hour rules to draw, inclusive of both bounds. */
export function hourRules(day: Pick<ScheduleDay, 'startHour' | 'endHour'>): number[] {
  const hours: number[] = [];
  for (let hour = day.startHour; hour <= day.endHour; hour += 1) {
    hours.push(hour);
  }
  return hours;
}

/**
 * Offset of the live current-time rule, or `null` when now falls outside the
 * drawn range so the caller can omit the rule rather than pin it to an edge.
 */
export function currentTimeOffset(
  now: Date,
  day: Pick<ScheduleDay, 'startHour' | 'endHour' | 'timeZone'>,
  hourHeight: number,
): number | null {
  const minutes = zonedMinutesOfDay(now, day.timeZone);
  if (minutes < day.startHour * MINUTES_PER_HOUR || minutes > day.endHour * MINUTES_PER_HOUR) {
    return null;
  }
  return offsetForMinutes(minutes, day, hourHeight);
}
