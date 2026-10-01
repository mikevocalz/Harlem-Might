import {
  addDays,
  addMonths as addMonthsFns,
  format,
  isSameDay as isSameDayFns,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

/**
 * Calendar math for the mini calendar.
 *
 * date-fns handles the CALENDAR arithmetic (month boundaries, week starts,
 * month stepping). Time-zone resolution stays on Intl in model.ts — that code
 * is tested against DST transitions and date-fns would need @date-fns/tz to do
 * the same job, so the split is deliberate rather than accidental.
 */

/** Sunday-first weekday initials, matching the reference's header row. */
export const WEEKDAY_INITIALS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

export interface MonthCell {
  date: Date;
  /** False for the leading/trailing days that pad the grid to whole weeks. */
  inMonth: boolean;
}

/**
 * Six weeks of cells covering `month`, Sunday-first.
 *
 * Always six rows, never five-or-six: a grid that changes height as you page
 * through months makes everything below it jump. The padding days are real
 * dates from the adjacent months rather than blanks, so they stay selectable.
 */
export function monthMatrix(month: Date): MonthCell[][] {
  const first = startOfMonth(month);
  const gridStart = startOfWeek(first, { weekStartsOn: 0 });
  const monthIndex = first.getMonth();

  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (__, day) => {
      const date = addDays(gridStart, week * 7 + day);
      return { date, inMonth: date.getMonth() === monthIndex };
    }),
  );
}

/** Same calendar day, ignoring time of day. */
export function isSameDay(a: Date, b: Date): boolean {
  return isSameDayFns(a, b);
}

/** Step by whole months. date-fns clamps rather than overflowing into March. */
export function addMonths(month: Date, delta: number): Date {
  return startOfMonth(addMonthsFns(month, delta));
}

export function formatMonthTitle(month: Date): string {
  return format(month, 'LLLL yyyy');
}
