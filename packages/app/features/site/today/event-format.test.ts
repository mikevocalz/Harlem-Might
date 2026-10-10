import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkedAt, checkedLabel, eventWhen, isStale, orderForToday, statusLabel, venueName } from './event-format.ts';

const tz = 'America/New_York';
// Intl inserts narrow/thin spaces in ranges and times; compare on plain spaces.
const plain = (s: string) => s.replace(/[   ]/g, ' ');

describe('eventWhen', () => {
  it('shows times only for a same-day event, in New York time', () => {
    // 23:30Z is 7:30 PM EDT; 02:00Z next day is 10:00 PM EDT the same NY day.
    const when = plain(eventWhen({ startsAt: '2026-10-07T23:30:00Z', endsAt: '2026-10-08T02:00:00Z', timeZone: tz }));
    assert.match(when, /7:30/);
    assert.match(when, /10:00 PM/);
    assert.doesNotMatch(when, /Oct/);
  });
  it('shows dates for a multi-day run', () => {
    const when = plain(eventWhen({ startsAt: '2026-10-05T23:30:00Z', endsAt: '2026-10-13T02:00:00Z', timeZone: tz }));
    assert.match(when, /Oct 5/);
    assert.match(when, /Oct 12/);
  });
});

describe('checkedAt', () => {
  it('takes the later of fetch and verification', () => {
    assert.equal(checkedAt({ fetchedAt: '2026-10-01T10:00:00Z', lastVerifiedAt: '2026-10-06T10:00:00Z' }), '2026-10-06T10:00:00Z');
    assert.equal(checkedAt({ fetchedAt: '2026-10-06T10:00:00Z', lastVerifiedAt: '2026-10-01T10:00:00Z' }), '2026-10-06T10:00:00Z');
  });
});

describe('checkedLabel', () => {
  const now = new Date('2026-10-07T20:00:00Z'); // 4 PM EDT
  it('says "today" with the New York time on the same NY day', () => {
    assert.equal(plain(checkedLabel('2026-10-07T19:10:00Z', now)), 'Checked today at 3:10 PM');
  });
  it('does not call a late-evening UTC-tomorrow check "today" in the wrong day', () => {
    // 02:00Z on the 8th is 10 PM EDT on the 7th: still today in Harlem.
    const late = new Date('2026-10-08T03:00:00Z');
    assert.match(plain(checkedLabel('2026-10-08T02:00:00Z', late)), /^Checked today at 10:00 PM$/);
  });
  it('shows the date for an earlier day, and the year when it differs', () => {
    assert.equal(checkedLabel('2026-10-05T15:00:00Z', now), 'Checked Oct 5');
    assert.equal(checkedLabel('2025-12-30T15:00:00Z', now), 'Checked Dec 30, 2025');
  });
});

describe('isStale', () => {
  const now = new Date('2026-10-07T20:00:00Z');
  it('flags listings checked more than seven days ago', () => {
    assert.equal(isStale('2026-09-29T20:00:00Z', now), true);
    assert.equal(isStale('2026-10-01T20:00:00Z', now), false);
  });
});

describe('statusLabel', () => {
  it('labels only events that are not running as listed', () => {
    assert.equal(statusLabel('scheduled'), null);
    assert.equal(statusLabel('cancelled'), 'Cancelled');
    assert.equal(statusLabel('postponed'), 'Postponed');
  });
});

describe('orderForToday', () => {
  it('keeps running events first in their order, then the rest', () => {
    const ordered = orderForToday([
      { id: 1, status: 'cancelled' as const },
      { id: 2, status: 'scheduled' as const },
      { id: 3, status: 'postponed' as const },
      { id: 4, status: 'scheduled' as const },
    ]);
    assert.deepEqual(
      ordered.map((e) => e.id),
      [2, 4, 1, 3],
    );
  });
});

describe('venueName', () => {
  it('prefers the catalogue place', () => {
    assert.equal(venueName({ place: { id: 1, slug: 'apollo-theater', name: 'Apollo Theater' }, venueName: 'Apollo' }), 'Apollo Theater');
    assert.equal(venueName({ venueName: 'Minton’s' }), 'Minton’s');
    assert.equal(venueName({}), null);
  });
});
