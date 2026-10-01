import type { ScheduleEvent } from './model.ts';

/**
 * Hour rule label, e.g. 8 -> "8AM", 13 -> "1PM", 0 -> "12AM".
 *
 * `startHour`/`endHour` are already wall-clock in the calendar's zone, so this
 * takes a plain hour and needs no zone of its own.
 */
export function formatHourLabel(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}${suffix}`;
}

const RANGE_DASH = '–';

function timeFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** e.g. "9:00 AM – 10:30 AM", rendered beneath an event title. */
export function formatTimeRange(event: ScheduleEvent, timeZone: string): string {
  const format = timeFormatter(timeZone);
  return `${format.format(event.start)} ${RANGE_DASH} ${format.format(event.end)}`;
}

/** Start time only, e.g. "1:30 PM". Ranges are unreadable in a dense picker. */
export function formatTime(instant: Date, timeZone: string): string {
  return timeFormatter(timeZone).format(instant);
}
