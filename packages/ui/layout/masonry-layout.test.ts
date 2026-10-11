import assert from 'node:assert/strict';
import { test } from 'node:test';
import { masonryColumnCount } from './masonry-layout.ts';

test('editorial cards adapt to the measured pane as a foldable opens and closes', () => {
  assert.deepEqual([360, 559, 560, 760, 819, 820, 896, 360].map(masonryColumnCount), [1, 1, 2, 2, 2, 3, 3, 1]);
});
