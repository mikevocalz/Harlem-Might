import assert from 'node:assert/strict';
import { it } from 'node:test';
import { eventRangeCacheTag, eventRetryCacheTag } from './event-cache-key.ts';

it('retry targets only the requested view/page using the server New York calendar date', () => {
  const now = new Date('2026-10-13T03:59:59Z');
  assert.equal(eventRetryCacheTag({ view: 'today', page: 2 }, now), eventRangeCacheTag('2026-10-12', '2026-10-12', 2));
  assert.equal(eventRetryCacheTag({ view: 'upcoming', page: 2 }, now), eventRangeCacheTag('2026-10-12', '2027-01-09', 2));
  assert.notEqual(eventRetryCacheTag({ view: 'upcoming', page: 1 }, now), eventRetryCacheTag({ view: 'upcoming', page: 2 }, now));
});

it('retry follows New York midnight and both DST changes without caller-supplied dates', () => {
  for (const [instant, date, end] of [
    ['2026-03-08T04:59:59Z', '2026-03-07', '2026-06-04'],
    ['2026-03-08T05:00:00Z', '2026-03-08', '2026-06-05'],
    ['2026-11-01T03:59:59Z', '2026-10-31', '2027-01-28'],
    ['2026-11-01T04:00:00Z', '2026-11-01', '2027-01-29'],
    ['2026-11-01T06:00:00Z', '2026-11-01', '2027-01-29'],
  ]) assert.equal(eventRetryCacheTag({ view: 'upcoming', page: 1 }, new Date(instant!)), eventRangeCacheTag(date!, end!, 1));
});

it('retry rejects malformed, unbounded, or extra input rather than invalidating a default tag', () => {
  for (const input of [undefined, null, [], '', {},
    { view: 'all', page: 1 }, { view: ['upcoming'], page: 1 },
    ...[0, -1, 1.5, NaN, Infinity, 10_001, '2', [2]].map((page) => ({ view: 'upcoming', page })),
    ...['tag', 'start', 'end', 'date'].map((key) => ({ view: 'upcoming', page: 1, [key]: 'arbitrary' })),
  ]) assert.throws(() => eventRetryCacheTag(input), /Invalid event retry/);
});
