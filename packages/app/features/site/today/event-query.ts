import { addHarlemDays, EVENT_RANGE_DAYS, type ContentReaders } from '../../../content/index.ts';

export type EventView = 'today' | 'upcoming';
export type EventSearch = { view: EventView; page: number };

/** URL values are untrusted; repeated, fractional and huge pages return to page 1. */
export function eventSearch(search: { view?: unknown; page?: unknown }): EventSearch {
  const raw = search.page;
  const page = typeof raw === 'number' ? raw : typeof raw === 'string' && /^[1-9]\d*$/.test(raw) ? Number(raw) : 1;
  return {
    view: search.view === 'upcoming' ? 'upcoming' : 'today',
    page: Number.isSafeInteger(page) && page > 0 && page <= 10_000 ? page : 1,
  };
}

/** Upcoming includes today and the following 89 New York calendar days. */
export function eventDateRange(date: string, view: EventView) {
  return { start: date, end: view === 'upcoming' ? addHarlemDays(date, EVENT_RANGE_DAYS - 1) : date };
}

/** Each view, Harlem date, range and page gets its own cache entry on native. */
export function eventQuery(readers: Pick<ContentReaders, 'listEventsForDateRange'>, date: string, search: EventSearch) {
  const { start, end } = eventDateRange(date, search.view);
  return {
    queryKey: ['events', search.view, start, end, search.page] as const,
    queryFn: () => readers.listEventsForDateRange(start, end, search.page),
  };
}
