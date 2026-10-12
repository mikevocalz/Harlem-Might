import { harlemToday } from '@acme/app/content';
import { eventDateRange } from '@acme/app/features/site/today/event-query.ts';

/** One failed public reader entry; successful results never carry this tag. */
export function eventRangeCacheTag(start: string, end: string, page: number) {
  return `public-event-failure:${start}:${end}:page:${page}`;
}

/** Server Actions accept untrusted input. Callers cannot choose dates or tags. */
export function eventRetryTarget(input: unknown, now = new Date()) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('Invalid event retry');
  const { view, page } = input as Record<string, unknown>;
  if (Object.keys(input).some((key) => key !== 'view' && key !== 'page') ||
      (view !== 'today' && view !== 'upcoming') || typeof page !== 'number' ||
      !Number.isSafeInteger(page) || page < 1 || page > 10_000) throw new Error('Invalid event retry');
  const { start, end } = eventDateRange(harlemToday(now), view);
  return { start, end, page, tag: eventRangeCacheTag(start, end, page) };
}
