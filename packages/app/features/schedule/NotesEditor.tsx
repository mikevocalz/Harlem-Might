'use client';
import { useCallback, useRef } from 'react';
import { createStore, useStore } from 'zustand';
import {
  EnrichedTextInput,
  type EnrichedTextInputInstance,
} from 'react-native-enriched-html';
import { View, Text } from '@acme/ui/tw';
import { AudioPlayer } from '@acme/ui';
import { Section } from '@acme/ui/primitives';
import { palette } from '@acme/theme';
import {
  COALESCE_MS,
  splitNoteSegments,
  useAttachStore,
  useAudioStore,
  useUrlStore,
  EditorToolbar,
  EMPTY_HISTORY,
  canRedo,
  canUndo,
  commit,
  redo as redoHistory,
  undo as undoHistory,
  type EditorStateKey,
  type HistoryState,
} from '../editor';

export interface NotesEditorProps {
  label: string;
  /** Initial HTML. The editor is uncontrolled — it owns its own document. */
  defaultValue?: string;
  placeholder?: string;
  /** Fires as the document changes; store the HTML, not the plain text. */
  onChangeHtml: (html: string) => void;
  /** Insert an image. Omit to disable the image button. */
  onPickImage?: () => Promise<{ uri: string; width: number; height: number } | null>;
  /** Opens editor settings; the host owns navigation. */
  onOpenSettings?: () => void;
}

/**
 * Everything the editor screen tracks that is not React state.
 *
 * One store rather than four: the toolbar reads all of it on every keystroke,
 * and splitting it would mean four subscriptions per render for values that
 * always change together.
 */
function createEditorStore() {
  return createStore<{
    history: HistoryState;
    activeState: Partial<Record<EditorStateKey, { isActive: boolean }>>;
    selection: { start: number; end: number; text: string };
    html: string;
    setHistory: (history: HistoryState) => void;
    setActiveState: (activeState: Partial<Record<EditorStateKey, { isActive: boolean }>>) => void;
    setSelection: (selection: { start: number; end: number; text: string }) => void;
    setHtml: (html: string) => void;
  }>((set) => ({
    history: EMPTY_HISTORY,
    activeState: {},
    selection: { start: 0, end: 0, text: '' },
    html: '',
    setHistory: (history) => set({ history }),
    setActiveState: (activeState) => set({ activeState }),
    setSelection: (selection) => set({ selection }),
    setHtml: (html) => set({ html }),
  }));
}

/**
 * Rich-text notes.
 *
 * `react-native-enriched-html` forks through its own exports map — a native
 * Fabric editor under the `react-native` condition, Tiptap on web — so one
 * import serves both platforms.
 *
 * The editor is UNCONTROLLED: it owns the document and reports HTML out.
 * Driving it from React state would fight the native view on every keystroke.
 *
 * The toolbar is not defined here. It is a projection of the capability
 * registry and the user's saved preferences (see `features/editor`), so which
 * buttons appear and in what order is a setting, not a hardcoded row.
 */
export function NotesEditor({
  label,
  defaultValue,
  placeholder,
  onChangeHtml,
  onPickImage,
  onOpenSettings,
}: NotesEditorProps) {
  const ref = useRef<EnrichedTextInputInstance>(null);
  const store = useRef<ReturnType<typeof createEditorStore> | null>(null);
  store.current ??= createEditorStore();

  const history = useStore(store.current, (state) => state.history);
  const activeState = useStore(store.current, (state) => state.activeState);
  const selection = useStore(store.current, (state) => state.selection);
  const requestAttachment = useAttachStore((state) => state.request);
  const requestRecording = useAudioStore((state) => state.request);
  const requestUrl = useUrlStore((state) => state.request);
  const html = useStore(store.current, (state) => state.html);

  /**
   * Voice notes, surfaced as players beneath the field.
   *
   * A video sits INLINE as an image node (its thumbnail) because the editor's
   * span-based layout can place a drawable in the text flow. Audio has no such
   * picture, so it stays a link in the text and becomes playable here.
   *
   * Neither can be a live player inline: an inline node is an ImageSpan holding
   * a Drawable, and a span cannot host a child view.
   */
  const media = splitNoteSegments(html).filter((segment) => segment.kind === 'audio');

  /**
   * Snapshots are coalesced: `onChangeHtml` fires per keystroke, and one Undo
   * per character is not undo. The timer restarts on every change, so a burst
   * of typing commits once, when the user pauses.
   */
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleChangeHtml = useCallback(
    (html: string) => {
      onChangeHtml(html);
      store.current?.getState().setHtml(html);
      if (pending.current !== null) clearTimeout(pending.current);
      pending.current = setTimeout(() => {
        const state = store.current?.getState();
        if (state === undefined) return;
        const { start, end } = state.selection;
        state.setHistory(commit(state.history, { html, selection: { start, end } }));
      }, COALESCE_MS);
    },
    [onChangeHtml],
  );

  /**
   * Restore a snapshot. `setValue` replaces the whole document and takes the
   * caret with it, so the recorded selection is re-applied afterwards.
   */
  const restore = useCallback((next: HistoryState) => {
    const snapshot = next.present;
    store.current?.getState().setHistory(next);
    if (snapshot === undefined || snapshot === null) return;
    ref.current?.setValue(snapshot.html);
    ref.current?.setSelection(snapshot.selection.start, snapshot.selection.end);
  }, []);

  const context = {
    editor: ref.current as EnrichedTextInputInstance,
    pickImage: onPickImage,
    // The dialog knows which kind it is collecting, so the YouTube variant can
    // preview the video before it is inserted.
    promptUrl: (title: string) => requestUrl(title.toLowerCase().includes('youtube') ? 'youtube' : 'link'),
    // The dialog is mounted at the app root, not here — a Modal inside a
    // bottom sheet stops the sheet mounting at all. The store carries the
    // request across that boundary and settles when the user picks or cancels.
    pickFile: () => requestAttachment(),
    recordAudio: () => requestRecording(),
    selection,
    undo: () => restore(undoHistory(history)),
    redo: () => restore(redoHistory(history)),
    canUndo: canUndo(history),
    canRedo: canRedo(history),
  };

  return (
    <Section className="gap-2">
      <Text className="text-sm font-medium text-text">{label}</Text>

      <EditorToolbar context={context} activeState={activeState} onOpenSettings={onOpenSettings} />

      <View className="rounded-md border-2 border-border bg-surface p-1">
        <EnrichedTextInput
          ref={ref}
          defaultValue={defaultValue}
          placeholder={placeholder}
          onChangeHtml={(event) => handleChangeHtml(event.nativeEvent.value)}
          onChangeState={(event) =>
            store.current?.getState().setActiveState(event.nativeEvent)
          }
          onChangeSelection={(event) =>
            store.current?.getState().setSelection(event.nativeEvent)
          }
          cursorColor={palette.ink[950]}
          selectionColor={palette.burgundy[300]}
          placeholderTextColor={palette.ink[400]}
          // The editor is a native view, so its chrome takes style objects
          // rather than classNames — the same exception the Gorhom sheet makes.
          style={{
            minHeight: 140,
            borderRadius: 6,
            backgroundColor: palette.white,
            paddingHorizontal: 14,
            paddingVertical: 10,
            color: palette.ink[950],
            fontSize: 16,
          }}
          htmlStyle={{
            blockquote: { borderColor: palette.ink[950], borderWidth: 2, gapWidth: 12 },
            code: { color: palette.ink[950], backgroundColor: palette.ink[100] },
          }}
        />
      </View>

      {media.length > 0 ? (
        <View className="gap-2">
          {media.map((segment, index) => (
            <AudioPlayer key={`audio-${segment.value}-${index}`} uri={segment.value} label={segment.label} />
          ))}
        </View>
      ) : null}
    </Section>
  );
}
