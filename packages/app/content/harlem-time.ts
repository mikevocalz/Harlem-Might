// Harlem calendar days as UTC instants. "Today" and "tonight" are New York
// days, never server-UTC days.

export const HARLEM_TIME_ZONE = 'America/New_York';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const zoneParts = new Intl.DateTimeFormat('en-US', {
  timeZone: HARLEM_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const partsOf = (instant: Date) => {
  const parts = zoneParts.formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
};

/** Minutes New York is ahead of UTC at `instant` (negative: -240 or -300). */
const offsetMinutes = (instant: Date): number => {
  const p = partsOf(instant);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((wallAsUtc - instant.getTime()) / 60_000);
};

/** UTC epoch ms of 00:00 New York time on the given calendar day. */
const harlemMidnight = (year: number, month: number, day: number): number => {
  const wallAsUtc = Date.UTC(year, month - 1, day);
  // Two passes settle the offset on DST-change days.
  let instant = wallAsUtc - offsetMinutes(new Date(wallAsUtc)) * 60_000;
  instant = wallAsUtc - offsetMinutes(new Date(instant)) * 60_000;
  return instant;
};

/** True for a real calendar date written `YYYY-MM-DD`. */
export const isHarlemDate = (value: string): boolean => {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
};

/** The current New York calendar date as `YYYY-MM-DD`. */
export const harlemToday = (now: Date = new Date()): string => {
  const p = partsOf(now);
  return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
};

/**
 * The half-open UTC window `[start, end)` covering one New York calendar day.
 * Handles 23- and 25-hour DST days.
 *
 * @throws {RangeError} when `date` is not a real `YYYY-MM-DD` date.
 */
export const harlemDayBounds = (date: string): { start: Date; end: Date } => {
  if (!isHarlemDate(date)) {
    throw new RangeError(`Expected a New York calendar date as YYYY-MM-DD, got "${date}".`);
  }
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return {
    start: new Date(harlemMidnight(year, month, day)),
    end: new Date(harlemMidnight(year, month, day + 1)),
  };
};
