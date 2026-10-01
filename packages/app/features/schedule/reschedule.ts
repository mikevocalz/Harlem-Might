import { MINUTES_PER_HOUR } from './geometry.ts';
import type { ScheduleEvent } from './model.ts';

/**
 * Drag-to-reschedule policy.
 *
 * Pure and free of gesture plumbing: the snapping and clamping are where the
 * edge cases live, and they are the part worth testing.
 */

/** Drags land on the quarter hour. */
export const SNAP_MINUTES = 15;

const MS_PER_MINUTE = 60_000;

export interface DayBounds {
  startHour: number;
  endHour: number;
}

/** Round to the nearest snap increment. Halves round up, consistently. */
export function snapMinutes(minutes: number, increment: number = SNAP_MINUTES): number {
  return Math.round(minutes / increment) * increment;
}

/**
 * Move an event by a pixel delta, snapped and clamped inside the day.
 *
 * DURATION IS PRESERVED. Clamping moves the whole block rather than trimming
 * its end — a drag that runs off the bottom of the grid must not silently
 * shorten a 60-minute lesson to 20. If the event is longer than the visible
 * day it is pinned to the start rather than given a negative offset.
 */
export function rescheduleByOffset(params: {
  event: ScheduleEvent;
  deltaPx: number;
  hourHeight: number;
  bounds: DayBounds;
  /** Wall-clock minute-of-day the event currently starts at. */
  startMinutes: number;
  resourceId?: string;
}): ScheduleEvent {
  const { deltaPx, hourHeight, ...rest } = params;
  return rescheduleByMinutes({
    ...rest,
    deltaMinutes: (deltaPx / hourHeight) * MINUTES_PER_HOUR,
  });
}

/**
 * Same policy driven by minutes rather than pixels — the keyboard path, and the
 * one the pixel version delegates to so both can never diverge.
 */
export function rescheduleByMinutes(params: {
  event: ScheduleEvent;
  deltaMinutes: number;
  bounds: DayBounds;
  startMinutes: number;
  resourceId?: string;
}): ScheduleEvent {
  const { event, bounds, startMinutes, resourceId } = params;

  const durationMs = event.end.getTime() - event.start.getTime();
  const durationMinutes = durationMs / MS_PER_MINUTE;

  const deltaMinutes = snapMinutes(params.deltaMinutes);

  const dayStartMinutes = bounds.startHour * MINUTES_PER_HOUR;
  const dayEndMinutes = bounds.endHour * MINUTES_PER_HOUR;
  const latestStart = Math.max(dayStartMinutes, dayEndMinutes - durationMinutes);

  const desired = snapMinutes(startMinutes) + deltaMinutes;
  const clamped = Math.min(latestStart, Math.max(dayStartMinutes, desired));

  const shiftMinutes = clamped - startMinutes;
  const start = new Date(event.start.getTime() + shiftMinutes * MS_PER_MINUTE);

  return {
    ...event,
    resourceId: resourceId ?? event.resourceId,
    start,
    end: new Date(start.getTime() + durationMs),
  };
}

/** Replace one event in a day's list, leaving order and identity intact. */
export function withRescheduledEvent(
  events: readonly ScheduleEvent[],
  updated: ScheduleEvent,
): ScheduleEvent[] {
  return events.map((event) => (event.id === updated.id ? updated : event));
}

/** A moved event, stored by id so the source day data stays immutable. */
export interface EventOverride {
  start: Date;
  end: Date;
  resourceId: string;
}

/**
 * Apply pending moves over a day's events.
 *
 * Overrides are keyed by id and layered at read time rather than written back
 * into the day, so the source data remains the server's and a move can be
 * discarded by dropping the override.
 */
export function applyOverrides(
  events: readonly ScheduleEvent[],
  overrides: Readonly<Record<string, EventOverride>>,
): ScheduleEvent[] {
  return events.map((event) => {
    const override = overrides[event.id];
    return override ? { ...event, ...override } : event;
  });
}
