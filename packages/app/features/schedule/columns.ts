import { zonedMinutesOfDay, type Resource, type ScheduleDay, type ScheduleEvent } from './model.ts';
import type { ScheduleView } from './store.ts';

/**
 * The grid's columns.
 *
 * Day view is resource-major (one column per instructor, date fixed); week view
 * is date-major (one column per day, resource fixed). Both reduce to the same
 * shape so the grid, the lane assignment and the geometry are written once.
 */
export interface GridColumn {
  id: string;
  label: string;
  accent: Resource['accent'];
  /** Present only in day view — the header shows an avatar for a person. */
  resource?: Resource;
}

const MS_PER_DAY = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Local calendar day key for an instant, in the calendar's zone. */
export function dayKey(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** Sunday-anchored start of the week containing `dayStart`. */
export function weekStart(dayStart: Date): Date {
  return new Date(dayStart.getTime() - dayStart.getDay() * MS_PER_DAY);
}

export function columnsForView(
  day: ScheduleDay,
  view: ScheduleView,
  focusedResourceId?: string,
): GridColumn[] {
  if (view === 'day') {
    return day.resources.map((resource) => ({
      id: resource.id,
      label: resource.name,
      accent: resource.accent,
      resource,
    }));
  }

  // Week: one column per day. The accent follows the focused resource so the
  // week reads as one person's schedule rather than a colour salad.
  const focused =
    day.resources.find((resource) => resource.id === focusedResourceId) ?? day.resources[0];
  const start = weekStart(day.dayStart);

  return WEEKDAYS.map((label, index) => {
    const date = new Date(start.getTime() + index * MS_PER_DAY);
    return {
      id: dayKey(date, day.timeZone),
      label: `${label} ${date.getDate()}`,
      accent: focused?.accent ?? 'ember',
    };
  });
}

/**
 * Which column an event belongs to, for the active view.
 *
 * Day view keys by resource; week view keys by calendar day, filtered to the
 * focused resource so two instructors' lessons never share a lane.
 */
export function columnIdForEvent(
  event: ScheduleEvent,
  view: ScheduleView,
  timeZone: string,
  focusedResourceId?: string,
): string | null {
  if (view === 'day') {
    return event.resourceId;
  }
  if (focusedResourceId && event.resourceId !== focusedResourceId) {
    return null;
  }
  return dayKey(event.start, timeZone);
}

/**
 * Day view shows a single date, so events from other days must be dropped or
 * they would stack onto the wrong column.
 */
export function eventsForView(
  day: ScheduleDay,
  events: readonly ScheduleEvent[],
  view: ScheduleView,
): ScheduleEvent[] {
  if (view !== 'day') return [...events];
  const key = dayKey(day.dayStart, day.timeZone);
  return events.filter((event) => dayKey(event.start, day.timeZone) === key);
}

/** Re-exported so the grid can position week events without another import. */
export { zonedMinutesOfDay };
