import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assignLanes } from './lanes.ts';
import { currentTimeOffset, eventRect, gridHeight, hourRules } from './geometry.ts';
import { eventsOverlap, zonedMinutesOfDay, type ScheduleEvent } from './model.ts';
import { slotsForResource } from './slots.ts';
import { monthMatrix, addMonths } from './month.ts';
import {
  rescheduleByOffset,
  rescheduleByMinutes,
  withRescheduledEvent,
  applyOverrides,
} from './reschedule.ts';

const ZONE = 'America/New_York';

/** Build an event from wall-clock times in ZONE on a fixed, non-DST-edge day. */
function event(id: string, startISO: string, endISO: string): ScheduleEvent {
  return {
    id,
    resourceId: 'r1',
    title: id,
    start: new Date(startISO),
    end: new Date(endISO),
    kind: 'lesson',
  };
}

describe('zonedMinutesOfDay', () => {
  it('reads wall-clock minutes in the target zone, not the host zone', () => {
    // 14:00Z is 09:00 in New York (EDT, UTC-5 offset on this date).
    assert.equal(zonedMinutesOfDay(new Date('2026-06-15T13:00:00Z'), ZONE), 9 * 60);
  });

  it('tracks the DST offset change rather than a fixed offset', () => {
    // Same UTC wall time either side of the US DST boundary lands on different
    // local hours: EST (UTC-5) in January, EDT (UTC-4) in June.
    const winter = zonedMinutesOfDay(new Date('2026-01-15T13:00:00Z'), ZONE);
    const summer = zonedMinutesOfDay(new Date('2026-06-15T13:00:00Z'), ZONE);
    assert.equal(winter, 8 * 60);
    assert.equal(summer, 9 * 60);
    assert.notEqual(winter, summer);
  });

  it('reports midnight as 0, never 1440', () => {
    assert.equal(zonedMinutesOfDay(new Date('2026-06-15T04:00:00Z'), ZONE), 0);
  });
});

describe('eventsOverlap', () => {
  it('does not collide events that merely touch', () => {
    const a = event('a', '2026-06-15T13:00:00Z', '2026-06-15T14:00:00Z');
    const b = event('b', '2026-06-15T14:00:00Z', '2026-06-15T15:00:00Z');
    assert.equal(eventsOverlap(a, b), false);
  });
});

describe('assignLanes', () => {
  it('keeps sequential events in a single lane at full width', () => {
    const laid = assignLanes([
      event('a', '2026-06-15T13:00:00Z', '2026-06-15T14:00:00Z'),
      event('b', '2026-06-15T14:00:00Z', '2026-06-15T15:00:00Z'),
    ]);
    assert.deepEqual(
      laid.map((l) => [l.event.id, l.lane, l.laneCount]),
      [
        ['a', 0, 1],
        ['b', 0, 1],
      ],
    );
  });

  it('splits two concurrent events into two lanes', () => {
    const laid = assignLanes([
      event('a', '2026-06-15T13:00:00Z', '2026-06-15T14:00:00Z'),
      event('b', '2026-06-15T13:30:00Z', '2026-06-15T14:30:00Z'),
    ]);
    assert.deepEqual(laid.map((l) => l.lane), [0, 1]);
    assert.deepEqual(laid.map((l) => l.laneCount), [2, 2]);
  });

  it('spans a middle event that starts before and ends after the other two', () => {
    // `spanning` covers both `early` and `late`, which do not touch each other.
    const spanning = event('spanning', '2026-06-15T13:00:00Z', '2026-06-15T17:00:00Z');
    const early = event('early', '2026-06-15T13:30:00Z', '2026-06-15T14:30:00Z');
    const late = event('late', '2026-06-15T15:30:00Z', '2026-06-15T16:30:00Z');

    const laid = assignLanes([early, late, spanning]);
    const byId = new Map(laid.map((l) => [l.event.id, l]));

    // The spanning event takes the leading lane.
    assert.equal(byId.get('spanning')?.lane, 0);
    // Both short events sit beside it, and may reuse the same lane because
    // they do not overlap each other.
    assert.equal(byId.get('early')?.lane, 1);
    assert.equal(byId.get('late')?.lane, 1);

    // The whole cluster is transitively connected through `spanning`, so every
    // block is sized against the SAME division. If laneCount were computed per
    // event, these would disagree and the blocks would not line up.
    const counts = laid.map((l) => l.laneCount);
    assert.deepEqual(counts, [2, 2, 2]);
  });

  it('keeps disjoint clusters independent', () => {
    // Morning pair overlaps; afternoon single does not touch it.
    const laid = assignLanes([
      event('m1', '2026-06-15T13:00:00Z', '2026-06-15T14:00:00Z'),
      event('m2', '2026-06-15T13:30:00Z', '2026-06-15T14:30:00Z'),
      event('afternoon', '2026-06-15T18:00:00Z', '2026-06-15T19:00:00Z'),
    ]);
    const byId = new Map(laid.map((l) => [l.event.id, l]));

    assert.equal(byId.get('m1')?.laneCount, 2);
    assert.equal(byId.get('m2')?.laneCount, 2);
    // The lone afternoon event must NOT be squeezed to half width by an
    // unrelated morning collision.
    assert.equal(byId.get('afternoon')?.laneCount, 1);
    assert.equal(byId.get('afternoon')?.lane, 0);
  });

  it('returns an empty layout for an empty column', () => {
    assert.deepEqual(assignLanes([]), []);
  });

  it('does not depend on input order', () => {
    const a = event('a', '2026-06-15T13:00:00Z', '2026-06-15T14:00:00Z');
    const b = event('b', '2026-06-15T13:30:00Z', '2026-06-15T14:30:00Z');
    const forward = assignLanes([a, b]).map((l) => [l.event.id, l.lane]);
    const reverse = assignLanes([b, a]).map((l) => [l.event.id, l.lane]);
    assert.deepEqual(forward, reverse);
  });
});

describe('geometry', () => {
  const day = { startHour: 8, endHour: 20, timeZone: ZONE };
  const HOUR = 60;

  it('places a 9am event one hour below an 8am grid start', () => {
    const [laid] = assignLanes([event('a', '2026-06-15T13:00:00Z', '2026-06-15T14:00:00Z')]);
    assert.ok(laid);
    const rect = eventRect(laid, day, HOUR);
    assert.equal(rect.top, HOUR);
    assert.equal(rect.height, HOUR);
    assert.equal(rect.leftFraction, 0);
    assert.equal(rect.widthFraction, 1);
  });

  it('clamps a very short event to a legible height without moving its top', () => {
    const [laid] = assignLanes([event('a', '2026-06-15T13:00:00Z', '2026-06-15T13:05:00Z')]);
    assert.ok(laid);
    const rect = eventRect(laid, day, HOUR);
    assert.equal(rect.top, HOUR, 'top must still report the true start');
    assert.ok(rect.height >= 24);
  });

  it('halves the width of two concurrent events and offsets the second', () => {
    const laid = assignLanes([
      event('a', '2026-06-15T13:00:00Z', '2026-06-15T14:00:00Z'),
      event('b', '2026-06-15T13:30:00Z', '2026-06-15T14:30:00Z'),
    ]);
    const rects = laid.map((l) => eventRect(l, day, HOUR));
    assert.equal(rects[0]?.leftFraction, 0);
    assert.equal(rects[1]?.leftFraction, 0.5);
    for (const rect of rects) {
      assert.ok(rect && rect.widthFraction < 0.5, 'lanes leave a gutter');
    }
  });

  it('draws an inclusive rule for every hour', () => {
    assert.deepEqual(hourRules({ startHour: 8, endHour: 11 }), [8, 9, 10, 11]);
    assert.equal(gridHeight(day, HOUR), 12 * HOUR);
  });

  it('omits the current-time rule when now is outside the drawn range', () => {
    // 05:00 New York, before the 8am grid start.
    assert.equal(currentTimeOffset(new Date('2026-06-15T09:00:00Z'), day, HOUR), null);
    // 13:00 New York, inside it.
    assert.equal(currentTimeOffset(new Date('2026-06-15T17:00:00Z'), day, HOUR), 5 * HOUR);
  });
});

describe('slotsForResource', () => {
  const dayStart = new Date('2026-06-15T12:00:00Z'); // 08:00 New York

  it('divides the window into fixed increments regardless of bookings', () => {
    const slots = slotsForResource({
      dayStart,
      startHour: 8,
      endHour: 10,
      events: [],
      resourceId: 'r1',
    });
    assert.equal(slots.length, 4);
    assert.ok(slots.every((slot) => slot.available));
  });

  it('marks only the slots a booking actually covers as unavailable', () => {
    const slots = slotsForResource({
      dayStart,
      startHour: 8,
      endHour: 10,
      events: [event('busy', '2026-06-15T12:30:00Z', '2026-06-15T13:00:00Z')],
      resourceId: 'r1',
    });
    assert.deepEqual(
      slots.map((slot) => slot.available),
      [true, false, true, true],
    );
  });

  it('ignores bookings belonging to a different resource', () => {
    const other = { ...event('x', '2026-06-15T12:00:00Z', '2026-06-15T13:00:00Z'), resourceId: 'r2' };
    const slots = slotsForResource({
      dayStart,
      startHour: 8,
      endHour: 9,
      events: [other],
      resourceId: 'r1',
    });
    assert.ok(slots.every((slot) => slot.available));
  });
});

describe('rescheduleByOffset', () => {
  const bounds = { startHour: 8, endHour: 20 };
  const HOUR = 60; // 1px per minute, so px deltas read as minutes

  const lesson = event('l', '2026-06-15T13:00:00Z', '2026-06-15T14:00:00Z'); // 9-10am NY

  it('snaps a ragged drag to the quarter hour', () => {
    const moved = rescheduleByOffset({
      event: lesson,
      deltaPx: 20, // 20 minutes -> snaps to 15
      hourHeight: HOUR,
      bounds,
      startMinutes: 9 * 60,
    });
    assert.equal(zonedMinutesOfDay(moved.start, ZONE), 9 * 60 + 15);
  });

  it('preserves duration when clamped at the end of the day', () => {
    const moved = rescheduleByOffset({
      event: lesson,
      deltaPx: 100000,
      hourHeight: HOUR,
      bounds,
      startMinutes: 9 * 60,
    });
    // Pinned so the block ENDS at 8pm, not trimmed to fit.
    assert.equal(zonedMinutesOfDay(moved.start, ZONE), 19 * 60);
    assert.equal(moved.end.getTime() - moved.start.getTime(), 60 * 60_000);
  });

  it('preserves duration when clamped at the start of the day', () => {
    const moved = rescheduleByOffset({
      event: lesson,
      deltaPx: -100000,
      hourHeight: HOUR,
      bounds,
      startMinutes: 9 * 60,
    });
    assert.equal(zonedMinutesOfDay(moved.start, ZONE), 8 * 60);
    assert.equal(moved.end.getTime() - moved.start.getTime(), 60 * 60_000);
  });

  it('pins an over-long event to the day start rather than a negative offset', () => {
    const marathon = event('m', '2026-06-15T13:00:00Z', '2026-06-16T05:00:00Z'); // 16h
    const moved = rescheduleByOffset({
      event: marathon,
      deltaPx: 5000,
      hourHeight: HOUR,
      bounds,
      startMinutes: 9 * 60,
    });
    assert.equal(zonedMinutesOfDay(moved.start, ZONE), 8 * 60);
  });

  it('reassigns the resource when dragged into another column', () => {
    const moved = rescheduleByOffset({
      event: lesson,
      deltaPx: 0,
      hourHeight: HOUR,
      bounds,
      startMinutes: 9 * 60,
      resourceId: 'grace',
    });
    assert.equal(moved.resourceId, 'grace');
    assert.equal(moved.id, lesson.id, 'identity survives the move');
  });

  it('does not mutate the original event', () => {
    const before = lesson.start.getTime();
    rescheduleByOffset({
      event: lesson,
      deltaPx: 240,
      hourHeight: HOUR,
      bounds,
      startMinutes: 9 * 60,
    });
    assert.equal(lesson.start.getTime(), before);
  });

  it('re-lanes correctly once moved onto a neighbour', () => {
    const other = event('o', '2026-06-15T13:00:00Z', '2026-06-15T14:00:00Z');
    const moved = rescheduleByOffset({
      event: event('x', '2026-06-15T15:00:00Z', '2026-06-15T16:00:00Z'),
      deltaPx: -120, // two hours earlier, onto `other`
      hourHeight: HOUR,
      bounds,
      startMinutes: 11 * 60,
    });
    const laid = assignLanes(withRescheduledEvent([other, moved], moved));
    assert.deepEqual(laid.map((l) => l.laneCount), [2, 2]);
  });
});

describe('applyOverrides', () => {
  const base = [
    event('a', '2026-06-15T13:00:00Z', '2026-06-15T14:00:00Z'),
    event('b', '2026-06-15T15:00:00Z', '2026-06-15T16:00:00Z'),
  ];

  it('layers a move without touching the source array', () => {
    const moved = rescheduleByMinutes({
      event: base[0]!,
      deltaMinutes: 60,
      bounds: { startHour: 8, endHour: 20 },
      startMinutes: 9 * 60,
    });
    const out = applyOverrides(base, {
      a: { start: moved.start, end: moved.end, resourceId: moved.resourceId },
    });

    assert.equal(zonedMinutesOfDay(out[0]!.start, ZONE), 10 * 60);
    assert.equal(zonedMinutesOfDay(base[0]!.start, ZONE), 9 * 60, 'source is untouched');
    assert.equal(out[1], base[1], 'unmoved events keep identity');
  });

  it('is a no-op with no overrides', () => {
    assert.deepEqual(applyOverrides(base, {}), base);
  });

  it('keeps title and kind when moving', () => {
    const out = applyOverrides(base, {
      a: { start: new Date('2026-06-15T17:00:00Z'), end: new Date('2026-06-15T18:00:00Z'), resourceId: 'grace' },
    });
    assert.equal(out[0]!.title, 'a');
    assert.equal(out[0]!.kind, 'lesson');
    assert.equal(out[0]!.resourceId, 'grace');
  });
});

describe('monthMatrix', () => {
  it('always returns six whole weeks so the grid never changes height', () => {
    for (const m of [new Date(2026, 0, 1), new Date(2026, 1, 1), new Date(2026, 7, 1)]) {
      const weeks = monthMatrix(m);
      assert.equal(weeks.length, 6);
      assert.ok(weeks.every((w) => w.length === 7));
    }
  });

  it('starts on Sunday and pads with real adjacent-month dates', () => {
    // 1 June 2026 is a Monday, so the grid opens on Sunday 31 May.
    const weeks = monthMatrix(new Date(2026, 5, 1));
    const first = weeks[0]![0]!;
    assert.equal(first.date.getDay(), 0);
    assert.equal(first.date.getDate(), 31);
    assert.equal(first.inMonth, false, 'padding days are flagged, not blank');
    assert.equal(weeks[0]![1]!.inMonth, true);
    assert.equal(weeks[0]![1]!.date.getDate(), 1);
  });

  it('flags exactly the days belonging to the month', () => {
    const weeks = monthMatrix(new Date(2026, 5, 1));
    const inMonth = weeks.flat().filter((c) => c.inMonth);
    assert.equal(inMonth.length, 30, 'June has 30 days');
  });
});

describe('addMonths', () => {
  it('does not overflow when stepping from a 31-day month', () => {
    // setMonth on 31 Jan would roll into March; this must land on 1 Feb.
    const next = addMonths(new Date(2026, 0, 31), 1);
    assert.equal(next.getMonth(), 1);
    assert.equal(next.getDate(), 1);
  });

  it('crosses year boundaries in both directions', () => {
    assert.equal(addMonths(new Date(2026, 11, 1), 1).getFullYear(), 2027);
    assert.equal(addMonths(new Date(2026, 0, 1), -1).getFullYear(), 2025);
  });
});
