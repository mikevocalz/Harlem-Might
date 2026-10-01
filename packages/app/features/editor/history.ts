/**
 * Undo/redo for an editor that has neither.
 *
 * `EnrichedTextInputInstance` exposes no undo or redo (grep the type: zero
 * matches). Tiptap's History extension is compiled into the package's WEB fork
 * only. So on native this is a snapshot stack over the HTML the editor already
 * emits: push on change, restore with `setValue`.
 *
 * COALESCING is the whole design problem. `onChangeHtml` fires per keystroke,
 * and a stack of keystrokes makes Undo useless — twenty presses to remove a
 * sentence. Snapshots are therefore committed only after the user pauses, so
 * one Undo removes one burst of typing, which is what a person means by "undo".
 *
 * The caret is the known cost: `setValue` is documented as replacing the ENTIRE
 * content (types.d.ts:384), so the selection is lost. Each snapshot records the
 * selection alongside the HTML and re-applies it with `setSelection`.
 */

export const COALESCE_MS = 600;
/** Deep enough to cover a session's edits, shallow enough to stay cheap. */
export const HISTORY_LIMIT = 50;

export interface Snapshot {
  readonly html: string;
  readonly selection: { start: number; end: number };
}

export interface HistoryState {
  readonly past: readonly Snapshot[];
  readonly present: Snapshot | null;
  readonly future: readonly Snapshot[];
}

export const EMPTY_HISTORY: HistoryState = { past: [], present: null, future: [] };

/**
 * Record a snapshot.
 *
 * Redo is discarded on a new edit — the standard model: once you type after
 * undoing, the branch you abandoned is gone. An unchanged document is ignored
 * so a selection move alone does not fill the stack.
 */
export function commit(state: HistoryState, snapshot: Snapshot): HistoryState {
  if (state.present?.html === snapshot.html) {
    return { ...state, present: snapshot };
  }

  const past = state.present === null ? state.past : [...state.past, state.present];
  return {
    past: past.slice(-HISTORY_LIMIT),
    present: snapshot,
    future: [],
  };
}

export function canUndo(state: HistoryState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: HistoryState): boolean {
  return state.future.length > 0;
}

/** Step back. Returns the same state when there is nothing to undo. */
export function undo(state: HistoryState): HistoryState {
  const previous = state.past[state.past.length - 1];
  if (previous === undefined || state.present === null) return state;

  return {
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future],
  };
}

/** Step forward. Returns the same state when there is nothing to redo. */
export function redo(state: HistoryState): HistoryState {
  const next = state.future[0];
  if (next === undefined || state.present === null) return state;

  return {
    past: [...state.past, state.present],
    present: next,
    future: state.future.slice(1),
  };
}
