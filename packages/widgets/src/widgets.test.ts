import assert from 'node:assert/strict';
import test from 'node:test';
import { beginWalk, confirmStop, pauseWalk, resumeWalk, reconcileWalkSessions, nextStopId } from './walk-session.ts';
import { buildWidgetSnapshot, harlemDay } from './snapshot.ts';
import { toMobileDeepLink, widgetPaths } from './deep-links.ts';

const walk = {
  id: 'w1', slug: 'harlem-renaissance', title: 'Harlem Renaissance Walk',
  stopIds: ['apollo', 'schomburg'], published: true,
  sourceUrl: 'https://example.org/walk',
} as const;

test('walk progress is ordered and idempotent across devices', () => {
  const start = beginWalk(walk, 'session-1', '2026-10-08T12:00:00Z');
  assert.equal(nextStopId(start), 'apollo');
  assert.throws(() => confirmStop(start, 'schomburg', '2026-10-08T12:01:00Z'));
  const first = confirmStop(start, 'apollo', '2026-10-08T12:01:00Z');
  assert.deepEqual(confirmStop(first, 'apollo', '2026-10-08T12:02:00Z'), first);
  assert.equal(reconcileWalkSessions(start, first).revision, 1);
  const finished = confirmStop(first, 'schomburg', '2026-10-08T12:02:00Z');
  assert.equal(finished.status, 'completed');
  assert.equal(nextStopId(finished), null);
});

test('pause blocks confirmation and resume enables it', () => {
  const s = beginWalk(walk, 's2', '2026-10-08T12:00:00Z');
  const paused = pauseWalk(s, '2026-10-08T12:00:01Z');
  assert.throws(() => confirmStop(paused, 'apollo', '2026-10-08T12:00:02Z'));
  const resumed = resumeWalk(paused, '2026-10-08T12:00:03Z');
  assert.equal(confirmStop(resumed, 'apollo', '2026-10-08T12:00:04Z').revision, 3);
});

test('Harlem day uses New York timezone across midnight and DST', () => {
  assert.equal(harlemDay('2026-10-09T02:10:00Z'), '2026-10-08');
  assert.equal(harlemDay('2026-07-01T03:59:00Z'), '2026-06-30');
});

test('snapshot excludes stale, cancelled and unsourced events', () => {
  const now = '2026-10-08T12:00:00Z';
  const event = {
    id: 'e1', title: 'Live Jazz', venueName: 'Harlem Hall',
    startsAt: '2026-10-08T23:00:00Z', endsAt: '2026-10-09T01:00:00Z',
    status: 'scheduled' as const, published: true, sourceUrl: 'https://example.org/event',
    lastVerifiedAt: '2026-10-08T11:00:00Z',
  };
  const data = {stories: [], places: [], events: [event]};
  const ok = buildWidgetSnapshot(data, now);
  assert.equal(ok.event?.title, 'Live Jazz');
  assert.equal(buildWidgetSnapshot({...data, events: [{...event, status:'cancelled' as const}]}, now).event, null);
  assert.equal(buildWidgetSnapshot({...data, events: [{...event, lastVerifiedAt:'2026-10-01T00:00:00Z'}]}, now).event, null);
  assert.equal(buildWidgetSnapshot({...data, events: [{...event, sourceUrl:''}]}, now).event, null);
  assert.equal(ok.story, null);
});

test('deep links stay within the Harlem Might route allowlist', () => {
  assert.equal(toMobileDeepLink(widgetPaths.place('apollo-theater')), 'harlemmight://explore?place=apollo-theater');
  assert.throws(() => widgetPaths.place('https://evil.example'));
  assert.throws(() => toMobileDeepLink('/../admin'));
});
