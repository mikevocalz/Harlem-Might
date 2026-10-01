import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canRedo,
  canUndo,
  commit,
  EMPTY_HISTORY,
  HISTORY_LIMIT,
  redo,
  undo,
  type Snapshot,
} from './history.ts';

const snap = (html: string, start = html.length): Snapshot => ({
  html,
  selection: { start, end: start },
});

describe('commit', () => {
  it('makes the first snapshot the present with nothing to undo', () => {
    const state = commit(EMPTY_HISTORY, snap('<p>a</p>'));
    assert.equal(state.present?.html, '<p>a</p>');
    assert.equal(canUndo(state), false);
  });

  it('pushes the previous present onto the past', () => {
    let state = commit(EMPTY_HISTORY, snap('<p>a</p>'));
    state = commit(state, snap('<p>ab</p>'));
    assert.deepEqual(state.past.map((s) => s.html), ['<p>a</p>']);
    assert.equal(canUndo(state), true);
  });

  it('ignores an unchanged document so a caret move does not fill the stack', () => {
    let state = commit(EMPTY_HISTORY, snap('<p>a</p>', 1));
    state = commit(state, snap('<p>a</p>', 0));
    assert.equal(state.past.length, 0);
    // The newer selection still wins, so undo restores where the caret was.
    assert.equal(state.present?.selection.start, 0);
  });

  it('discards redo once a new edit lands', () => {
    let state = commit(EMPTY_HISTORY, snap('<p>a</p>'));
    state = commit(state, snap('<p>ab</p>'));
    state = undo(state);
    assert.equal(canRedo(state), true);
    state = commit(state, snap('<p>ax</p>'));
    assert.equal(canRedo(state), false);
  });

  it('caps the past at the limit', () => {
    let state = EMPTY_HISTORY;
    for (let i = 0; i < HISTORY_LIMIT + 20; i += 1) {
      state = commit(state, snap(`<p>${i}</p>`));
    }
    assert.equal(state.past.length, HISTORY_LIMIT);
    // The cap drops the OLDEST entries, not the newest.
    assert.equal(state.past[state.past.length - 1]?.html, `<p>${HISTORY_LIMIT + 18}</p>`);
  });
});

describe('undo / redo', () => {
  it('round-trips back to the same document', () => {
    let state = commit(EMPTY_HISTORY, snap('<p>a</p>'));
    state = commit(state, snap('<p>ab</p>'));
    const undone = undo(state);
    assert.equal(undone.present?.html, '<p>a</p>');
    assert.equal(redo(undone).present?.html, '<p>ab</p>');
  });

  it('restores the selection recorded with the snapshot', () => {
    let state = commit(EMPTY_HISTORY, snap('<p>hello</p>', 3));
    state = commit(state, snap('<p>hello world</p>', 11));
    assert.equal(undo(state).present?.selection.start, 3);
  });

  it('is a no-op at either end rather than throwing', () => {
    assert.deepEqual(undo(EMPTY_HISTORY), EMPTY_HISTORY);
    assert.deepEqual(redo(EMPTY_HISTORY), EMPTY_HISTORY);

    const single = commit(EMPTY_HISTORY, snap('<p>a</p>'));
    assert.deepEqual(undo(single), single);
    assert.deepEqual(redo(single), single);
  });

  it('walks the whole stack and back', () => {
    let state = EMPTY_HISTORY;
    for (const html of ['<p>1</p>', '<p>2</p>', '<p>3</p>']) state = commit(state, snap(html));

    state = undo(undo(state));
    assert.equal(state.present?.html, '<p>1</p>');
    assert.equal(canUndo(state), false);

    state = redo(redo(state));
    assert.equal(state.present?.html, '<p>3</p>');
    assert.equal(canRedo(state), false);
  });
});
