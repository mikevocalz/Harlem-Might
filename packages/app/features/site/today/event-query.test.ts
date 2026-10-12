import assert from 'node:assert/strict';
import { it } from 'node:test';
import { eventDateRange, eventQuery, eventSearch } from './event-query.ts';
import { routes } from '../../../../ui/mights/routes.ts';
import type { ContentReaders } from '../../../content/index.ts';

it('normalizes URL state while keeping Today at the existing /today route', () => {
  assert.deepEqual(eventSearch({}), { view: 'today', page: 1 });
  assert.deepEqual(eventSearch({ view: 'upcoming', page: '2' }), { view: 'upcoming', page: 2 });
  assert.deepEqual(eventSearch({ view: ['upcoming'], page: ['2'] }), { view: 'today', page: 1 });
  for (const page of ['-1', '0', '1.5', 'NaN', '9007199254740993', 10001, Infinity]) {
    assert.equal(eventSearch({ page }).page, 1);
  }
  assert.equal(routes.today(), '/today');
  assert.equal(routes.today({ view: 'today', page: 1 }), '/today');
  assert.equal(routes.today({ view: 'upcoming', page: 2 }), '/today?view=upcoming&page=2');
});

it('Upcoming is a 90-calendar-day range including today across NY DST and year boundaries', () => {
  assert.deepEqual(eventDateRange('2026-10-12', 'today'), { start: '2026-10-12', end: '2026-10-12' });
  assert.deepEqual(eventDateRange('2026-10-12', 'upcoming'), { start: '2026-10-12', end: '2027-01-09' });
});

it('cache keys and readers follow view, page, restored params, and New York midnight changes', async () => {
  const calls: unknown[][] = [];
  const readers: Pick<ContentReaders, 'listEventsForDateRange'> = {
    listEventsForDateRange: async (...args) => { calls.push(args); return { status: 'ok', data: { events: [], totalDocs: 0, hasNextPage: false } }; },
  };
  const today = eventQuery(readers, '2026-10-12', eventSearch({}));
  const upcoming = eventQuery(readers, '2026-10-12', eventSearch({ view: 'upcoming' }));
  const second = eventQuery(readers, '2026-10-12', eventSearch({ view: 'upcoming', page: '2' }));
  const tomorrow = eventQuery(readers, '2026-10-13', eventSearch({ view: 'upcoming' }));
  assert.equal(new Set([today, upcoming, second, tomorrow].map((query) => JSON.stringify(query.queryKey))).size, 4);
  assert.deepEqual(eventQuery(readers, '2026-10-12', eventSearch({})).queryKey, today.queryKey);
  await upcoming.queryFn();
  await second.queryFn();
  assert.deepEqual(calls, [['2026-10-12', '2027-01-09', 1], ['2026-10-12', '2027-01-09', 2]]);
});
