import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDay, harlemClock, isOpenAt, parseOpeningHours } from './opening-hours.ts';

test('weekday ranges, comma days and off', () => {
  const week = parseOpeningHours('Mo-Fr 09:00-17:00; Sa,Su 10:00-16:00; Su off');
  assert.ok(week);
  assert.equal(formatDay(week[0]!), '9 AM – 5 PM');
  assert.equal(formatDay(week[5]!), '10 AM – 4 PM');
  assert.equal(formatDay(week[6]!), 'Closed');
});

test('24/7, split ranges and past midnight', () => {
  assert.equal(formatDay(parseOpeningHours('24/7')![3]!), 'Open 24 hours');
  const split = parseOpeningHours('Tu 11:00-15:00,17:30-22:00')!;
  assert.equal(formatDay(split[1]!), '11 AM – 3 PM, 5:30 PM – 10 PM');
  const late = parseOpeningHours('Fr 18:00-02:00')!;
  assert.equal(isOpenAt(late, 4, 23 * 60), true);
  assert.equal(isOpenAt(late, 5, 60), true, 'Saturday 1 AM is still Friday night');
  assert.equal(isOpenAt(late, 5, 3 * 60), false);
});

test('comma-space day lists and comma-separated rules', () => {
  const week = parseOpeningHours('Mo-Th, Sa 09:00-21:00')!;
  assert.equal(formatDay(week[5]!), '9 AM – 9 PM');
  assert.equal(formatDay(week[4]!), 'Closed');
  const two = parseOpeningHours('Mo-Th 11:00-23:00, Fr-Sa 11:00-24:00')!;
  assert.equal(formatDay(two[0]!), '11 AM – 11 PM');
  assert.equal(formatDay(two[5]!), '11 AM – Midnight');
});

test('unsupported syntax falls back to null', () => {
  assert.equal(parseOpeningHours('Mo-Fr 09:00-17:00; PH off'), null);
  assert.equal(parseOpeningHours('by appointment'), null);
});

test('harlemClock reads New York time', () => {
  // 2026-10-09T16:30Z is Friday 12:30 PM EDT.
  assert.deepEqual(harlemClock(new Date('2026-10-09T16:30:00Z')), { day: 4, minute: 12 * 60 + 30 });
});
