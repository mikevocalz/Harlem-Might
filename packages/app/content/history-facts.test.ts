import assert from 'node:assert/strict';
import { test } from 'node:test';
import { harlemHistoryFactFor } from './history-facts.ts';

test('exact month-day is on this day', () => {
  const { fact, onThisDay } = harlemHistoryFactFor('2026-03-12');
  assert.equal(fact.date, '1926-03-12');
  assert.equal(onThisDay, true);
});

test('otherwise the calendar-nearest fact, wrapping the year', () => {
  assert.equal(harlemHistoryFactFor('2026-10-09').fact.date, '1958-09-20');
  assert.equal(harlemHistoryFactFor('2026-12-31').fact.date, '1934-01-26');
  assert.equal(harlemHistoryFactFor('2026-11-30').fact.date, '1934-11-21');
  assert.equal(harlemHistoryFactFor('2026-01-20').fact.date, '1934-01-26');
  assert.equal(harlemHistoryFactFor('2026-10-09').onThisDay, false);
});
