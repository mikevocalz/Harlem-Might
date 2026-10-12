import assert from 'node:assert/strict';
import test from 'node:test';
import { addHarlemDays, harlemDayBounds, harlemToday, isHarlemDate } from './harlem-time.ts';

test('a summer day starts at 04:00Z (EDT) and lasts 24 hours', () => {
  const { start, end } = harlemDayBounds('2026-10-07');
  assert.equal(start.toISOString(), '2026-10-07T04:00:00.000Z');
  assert.equal(end.toISOString(), '2026-10-08T04:00:00.000Z');
});

test('a winter day starts at 05:00Z (EST)', () => {
  const { start } = harlemDayBounds('2026-01-15');
  assert.equal(start.toISOString(), '2026-01-15T05:00:00.000Z');
});

test('spring-forward day is 23 hours, fall-back day is 25 hours', () => {
  const spring = harlemDayBounds('2026-03-08');
  assert.equal(spring.start.toISOString(), '2026-03-08T05:00:00.000Z');
  assert.equal(spring.end.getTime() - spring.start.getTime(), 23 * 3_600_000);

  const fall = harlemDayBounds('2026-11-01');
  assert.equal(fall.start.toISOString(), '2026-11-01T04:00:00.000Z');
  assert.equal(fall.end.getTime() - fall.start.getTime(), 25 * 3_600_000);
});

test('month and year rollover', () => {
  assert.equal(harlemDayBounds('2026-12-31').end.toISOString(), '2027-01-01T05:00:00.000Z');
});

test('late evening in Harlem is still "today" even when UTC has rolled over', () => {
  // 23:30 EDT on Oct 7 is 03:30Z on Oct 8.
  assert.equal(harlemToday(new Date('2026-10-08T03:30:00Z')), '2026-10-07');
  assert.equal(harlemToday(new Date('2026-10-08T04:00:00Z')), '2026-10-08');
});

test('date validation rejects impossible and malformed dates', () => {
  assert.equal(isHarlemDate('2026-02-29'), false);
  assert.equal(isHarlemDate('2028-02-29'), true);
  assert.equal(isHarlemDate('2026-7-1'), false);
  assert.equal(isHarlemDate('today'), false);
  assert.throws(() => harlemDayBounds('2026-13-01'), RangeError);
});

test('calendar day addition crosses spring-forward and fall-back without skipping or repeating dates', () => {
  for (const [start, expected] of [
    ['2026-03-07', '2026-03-08'],
    ['2026-03-08', '2026-03-09'],
    ['2026-10-31', '2026-11-01'],
    ['2026-11-01', '2026-11-02'],
  ] as const) {
    assert.equal(addHarlemDays(start, 1), expected);
    assert.equal(addHarlemDays(expected, -1), start);
  }
});

test('calendar day addition handles month/year rollover, leap days, and zero days', () => {
  assert.equal(addHarlemDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addHarlemDays('2027-01-01', -1), '2026-12-31');
  assert.equal(addHarlemDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addHarlemDays('2028-02-28', 2), '2028-03-01');
  assert.equal(addHarlemDays('2026-02-28', 1), '2026-03-01');
  assert.equal(addHarlemDays('2026-10-12', 89), '2027-01-09');
  assert.equal(addHarlemDays('2026-10-12', 0), '2026-10-12');
});

test('calendar day addition rejects invalid dates, unsafe offsets, and date overflow', () => {
  for (const date of ['2026-02-29', '2026-13-01', '2026-7-01', '', 'today']) {
    assert.throws(() => addHarlemDays(date, 1), RangeError);
  }
  for (const days of [0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => addHarlemDays('2026-10-12', days), RangeError);
  }
  assert.throws(() => addHarlemDays('2026-10-12', Number.MAX_SAFE_INTEGER), RangeError);
  assert.throws(() => addHarlemDays('9999-12-31', 1), RangeError);
});
