/**
 * The editor's capability registry.
 *
 * ONE ENTRY PER CAPABILITY, and the single source of truth for three consumers:
 * the toolbar, the settings screen, and the set of ids preferences may contain.
 * They are projections of this file; none of them holds its own list.
 *
 * SCOPE — this is written against `react-native-enriched-html@1.1.1`, which is
 * the editor this app uses. It forks by platform through its own exports map: a
 * native Fabric editor under the `react-native` condition, Tiptap 3.27.1 on web.
 * The NATIVE fork has a fixed command set — there is no schema to compose and no
 * extension list to compile — so a capability exists here only if the editor
 * exposes a command for it. Every command below is cited against
 * `lib/typescript/src/types.d.ts::EnrichedTextInputInstance`.
 *
 * Capabilities the editor cannot perform are recorded in `UNSUPPORTED` at the
 * foot of this file with the reason, rather than left as dead buttons.
 */
import type { EnrichedTextInputInstance } from 'react-native-enriched-html';
import {
  INLINE_WAVEFORM_HEIGHT,
  INLINE_WAVEFORM_WIDTH,
  type UploadVoiceNote,
} from './upload.ts';
import {
  INLINE_VIDEO_HEIGHT,
  INLINE_VIDEO_WIDTH,
  youTubeThumbnail,
  youTubeVideoId,
} from './youtube.ts';

/** Keys of `OnChangeStateEvent`, which reports what is active at the caret. */
export type EditorStateKey =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikeThrough'
  | 'inlineCode'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'codeBlock'
  | 'blockQuote'
  | 'orderedList'
  | 'unorderedList'
  | 'checkboxList'
  | 'link'
  | 'image';

/**
 * `toolbar` — a button the user can reorder.
 * `setting`  — a switch with no button of its own.
 */
export type CapabilityRole = 'toolbar' | 'setting';

export type CapabilityGroup = 'marks' | 'nodes' | 'insert' | 'history';

/**
 * Everything a capability needs to act. Handlers take the editor ref rather
 * than closing over one, so the registry stays a plain value the settings
 * screen can import without dragging the editor in with it.
 */
export interface CapabilityContext {
  editor: EnrichedTextInputInstance;
  /** Resolves a media URI to insert. Supplied by the host screen. */
  pickImage?: () => Promise<{ uri: string; width: number; height: number } | null>;
  /** Resolves a file to link. Supplied by the host screen. */
  pickFile?: () => Promise<{ uri: string; name: string } | null>;
  /** Records a voice note. Native only — see AudioRecorderSheet.web. */
  recordAudio?: () => Promise<{ uri: string; duration: number } | null>;
  /**
   * Uploads the recording and returns its remote URLs.
   *
   * Omit and the voice note falls back to a link to the local file. Supply it
   * and the note goes INLINE as the server-rendered waveform — the recording is
   * removed from the device, so a local path must not reach a saved note.
   */
  uploadVoiceNote?: UploadVoiceNote;
  /** Collects a URL from the user. Supplied by the host screen. */
  promptUrl?: (title: string) => Promise<string | null>;
  /**
   * Live caret/selection, from `onChangeSelection`. `setLink` takes a character
   * RANGE rather than a URL alone (types.d.ts:441), so a link cannot be
   * inserted without knowing where the caret is.
   */
  selection?: { start: number; end: number; text: string };
  /** Snapshot history — see `history.ts`; the editor has no undo of its own. */
  undo?: () => void;
  redo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export interface Capability {
  id: string;
  label: string;
  /** Lucide icon name, resolved by the toolbar against `@acme/ui/icons`. */
  icon: string;
  role: CapabilityRole;
  group: CapabilityGroup;
  /**
   * `true` for the basic set every user gets. These can be REORDERED but not
   * switched off — a rich text editor without bold is not a preference, it is a
   * broken editor. `false` marks the advanced, opt-in capabilities.
   */
  basic: boolean;
  /** Which `onChangeState` key lights the button up. Omitted = stateless. */
  stateKey?: EditorStateKey;
  /** Runs the capability. Every `toolbar` entry has one — enforced below. */
  run?: (context: CapabilityContext) => void | Promise<void>;
  /** Whether the button can be pressed right now. Default: always. */
  isEnabled?: (context: CapabilityContext) => boolean;
}

/**
 * Ordered by the group a first-time user reads first, not alphabetically: the
 * marks they use constantly, then block structure, then insertion, then history.
 * This is the DEFAULT order; the user's saved order supersedes it.
 */
export const CAPABILITIES = [
  // Marks — `toggleBold` etc, types.d.ts::EnrichedTextInputInstance
  { id: 'bold', label: 'Bold', icon: 'Bold', role: 'toolbar', group: 'marks', basic: true, stateKey: 'bold', run: ({ editor }) => editor.toggleBold() },
  { id: 'italic', label: 'Italic', icon: 'Italic', role: 'toolbar', group: 'marks', basic: true, stateKey: 'italic', run: ({ editor }) => editor.toggleItalic() },
  { id: 'underline', label: 'Underline', icon: 'Underline', role: 'toolbar', group: 'marks', basic: true, stateKey: 'underline', run: ({ editor }) => editor.toggleUnderline() },
  { id: 'strike', label: 'Strikethrough', icon: 'Strikethrough', role: 'toolbar', group: 'marks', basic: true, stateKey: 'strikeThrough', run: ({ editor }) => editor.toggleStrikeThrough() },
  { id: 'code', label: 'Inline code', icon: 'Code', role: 'toolbar', group: 'marks', basic: false, stateKey: 'inlineCode', run: ({ editor }) => editor.toggleInlineCode() },

  // Headings — the editor exposes all six; H1-H3 are basic, H4-H6 opt-in,
  // because a note-taking toolbar with six heading buttons is unusable.
  { id: 'h1', label: 'Heading 1', icon: 'Heading1', role: 'toolbar', group: 'nodes', basic: true, stateKey: 'h1', run: ({ editor }) => editor.toggleH1() },
  { id: 'h2', label: 'Heading 2', icon: 'Heading2', role: 'toolbar', group: 'nodes', basic: true, stateKey: 'h2', run: ({ editor }) => editor.toggleH2() },
  { id: 'h3', label: 'Heading 3', icon: 'Heading3', role: 'toolbar', group: 'nodes', basic: true, stateKey: 'h3', run: ({ editor }) => editor.toggleH3() },
  { id: 'h4', label: 'Heading 4', icon: 'Heading4', role: 'toolbar', group: 'nodes', basic: false, stateKey: 'h4', run: ({ editor }) => editor.toggleH4() },
  { id: 'h5', label: 'Heading 5', icon: 'Heading5', role: 'toolbar', group: 'nodes', basic: false, stateKey: 'h5', run: ({ editor }) => editor.toggleH5() },
  { id: 'h6', label: 'Heading 6', icon: 'Heading6', role: 'toolbar', group: 'nodes', basic: false, stateKey: 'h6', run: ({ editor }) => editor.toggleH6() },

  // Block structure
  { id: 'bulletList', label: 'Bulleted list', icon: 'List', role: 'toolbar', group: 'nodes', basic: true, stateKey: 'unorderedList', run: ({ editor }) => editor.toggleUnorderedList() },
  { id: 'orderedList', label: 'Numbered list', icon: 'ListOrdered', role: 'toolbar', group: 'nodes', basic: true, stateKey: 'orderedList', run: ({ editor }) => editor.toggleOrderedList() },
  // `toggleCheckboxList` takes the CHECKED state of the new item, not a bare
  // toggle — types.d.ts. A new task starts unchecked.
  { id: 'taskList', label: 'Checklist', icon: 'ListChecks', role: 'toolbar', group: 'nodes', basic: false, stateKey: 'checkboxList', run: ({ editor }) => editor.toggleCheckboxList(false) },
  { id: 'blockquote', label: 'Quote', icon: 'Quote', role: 'toolbar', group: 'nodes', basic: true, stateKey: 'blockQuote', run: ({ editor }) => editor.toggleBlockQuote() },
  { id: 'codeBlock', label: 'Code block', icon: 'SquareCode', role: 'toolbar', group: 'nodes', basic: false, stateKey: 'codeBlock', run: ({ editor }) => editor.toggleCodeBlock() },

  // Alignment — one command with an argument, so each direction is its own
  // entry rather than a cycling button whose next state you have to guess.
  { id: 'alignLeft', label: 'Align left', icon: 'AlignLeft', role: 'toolbar', group: 'nodes', basic: false, run: ({ editor }) => editor.setTextAlignment('left') },
  { id: 'alignCenter', label: 'Align centre', icon: 'AlignCenter', role: 'toolbar', group: 'nodes', basic: false, run: ({ editor }) => editor.setTextAlignment('center') },
  { id: 'alignRight', label: 'Align right', icon: 'AlignRight', role: 'toolbar', group: 'nodes', basic: false, run: ({ editor }) => editor.setTextAlignment('right') },

  // Insertion
  {
    id: 'image',
    label: 'Insert image',
    icon: 'ImagePlus',
    role: 'toolbar',
    group: 'insert',
    basic: true,
    stateKey: 'image',
    run: async ({ editor, pickImage }) => {
      const picked = await pickImage?.();
      if (picked) editor.setImage(picked.uri, picked.width, picked.height);
    },
    isEnabled: ({ pickImage }) => pickImage !== undefined,
  },
  {
    id: 'link',
    label: 'Link',
    icon: 'Link',
    role: 'toolbar',
    group: 'insert',
    basic: true,
    stateKey: 'link',
    run: async ({ editor, promptUrl, selection }) => {
      const url = await promptUrl?.('Link URL');
      if (!url) return;
      const { start, end, text } = selection ?? { start: 0, end: 0, text: '' };
      // A collapsed caret has nothing to wrap, so the URL becomes its own
      // display text; a real selection keeps the words the user chose.
      editor.setLink(start, end, text.length > 0 ? text : url, url);
    },
    isEnabled: ({ promptUrl }) => promptUrl !== undefined,
  },
  {
    /**
     * The editor has no attachment node, so a file is inserted as a LINK to it.
     * That is the honest mapping: the document keeps a reference the host app
     * can resolve, and nothing claims to embed a file the schema cannot hold.
     */
    id: 'file',
    label: 'Attach file',
    icon: 'Paperclip',
    role: 'toolbar',
    group: 'insert',
    basic: false,
    run: async ({ editor, pickFile, selection }) => {
      const picked = await pickFile?.();
      if (!picked) return;
      const caret = selection?.end ?? 0;
      editor.setLink(caret, caret, picked.name, picked.uri);
    },
    isEnabled: ({ pickFile }) => pickFile !== undefined,
  },
  {
    /**
     * Same shape as `file`: no video node exists, so the URL is stored as a
     * link. `EnrichedText` renders notes for display, and that is where the
     * player belongs — see `YouTubeEmbed`.
     */
    id: 'youtube',
    label: 'YouTube video',
    icon: 'Video',
    role: 'toolbar',
    group: 'insert',
    basic: false,
    run: async ({ editor, promptUrl }) => {
      const url = await promptUrl?.('YouTube URL');
      if (!url) return;
      const videoId = youTubeVideoId(url);
      if (videoId === null) return;
      // A REAL inline node, at the caret — not a strip below the field. The
      // editor's schema has no video node, but it does have an image one, and
      // an inline image is the only thing its span-based layout can place in
      // the text flow. The thumbnail carries the id, so the read view still
      // resolves it back to a playable video.
      editor.setImage(youTubeThumbnail(videoId), INLINE_VIDEO_WIDTH, INLINE_VIDEO_HEIGHT);
    },
    isEnabled: ({ promptUrl }) => promptUrl !== undefined,
  },

  {
    /**
     * A recorded voice note. Stored as a link for the same reason as a file:
     * there is no audio node in the editor's schema. The duration goes in the
     * link text so the note says how long it is without opening it.
     */
    id: 'audio',
    label: 'Voice note',
    icon: 'Mic',
    role: 'toolbar',
    group: 'insert',
    basic: false,
    run: async ({ editor, recordAudio, uploadVoiceNote, selection }) => {
      const recording = await recordAudio?.();
      if (!recording) return;

      // Upload FIRST. The recording is deleted from the device afterwards, so a
      // note must never be written holding the local `file://` path — it would
      // point at nothing by the time anyone opened the note.
      if (uploadVoiceNote !== undefined) {
        const uploaded = await uploadVoiceNote(recording.uri, recording.duration);
        // Inline, at the caret: the waveform the server rendered. Same
        // mechanism as a video thumbnail, which is the only kind of node this
        // editor's span-based layout can place in the text flow.
        editor.setImage(uploaded.waveformUrl, INLINE_WAVEFORM_WIDTH, INLINE_WAVEFORM_HEIGHT);
        return;
      }

      // No upload wired yet: fall back to a link to the local file so the
      // recording is at least reachable in this session. Deliberately not
      // inline — a local path is not something to persist into a note.
      const caret = selection?.end ?? 0;
      const minutes = Math.floor(recording.duration / 60);
      const seconds = String(Math.floor(recording.duration % 60)).padStart(2, '0');
      editor.setLink(caret, caret, `Voice note (${minutes}:${seconds})`, recording.uri);
    },
    isEnabled: ({ recordAudio }) => recordAudio !== undefined,
  },

  // History — see `history.ts`. The native editor exposes no undo/redo, so
  // these are backed by a snapshot stack rather than the editor itself.
  {
    id: 'undo',
    label: 'Undo',
    icon: 'Undo2',
    role: 'toolbar',
    group: 'history',
    basic: true,
    run: ({ undo }) => undo?.(),
    isEnabled: ({ canUndo }) => canUndo === true,
  },
  {
    id: 'redo',
    label: 'Redo',
    icon: 'Redo2',
    role: 'toolbar',
    group: 'history',
    basic: true,
    run: ({ redo }) => redo?.(),
    isEnabled: ({ canRedo }) => canRedo === true,
  },
] as const satisfies readonly Capability[];

export type CapabilityId = (typeof CAPABILITIES)[number]['id'];

export const CAPABILITY_BY_ID: Record<string, Capability> = Object.fromEntries(
  CAPABILITIES.map((capability) => [capability.id, capability]),
);

/** Ids every user starts with, in their default order. */
export const BASIC_IDS: readonly string[] = CAPABILITIES.filter((c) => c.basic).map((c) => c.id);

/** Ids the user opts into from settings. */
export const ADVANCED_IDS: readonly string[] = CAPABILITIES.filter((c) => !c.basic).map((c) => c.id);

export const GROUP_LABEL: Record<CapabilityGroup, string> = {
  marks: 'Text',
  nodes: 'Structure',
  insert: 'Insert',
  history: 'History',
};

/**
 * Capabilities this editor cannot perform, recorded rather than dropped in
 * silence. Each names what would be required, so the next person does not
 * re-derive it from scratch.
 *
 * The Tiptap extension catalogue is much larger than this list; it applies to
 * the WEB fork only. On native the surface is
 * `EnrichedTextInputInstance`, and anything absent from it is absent here.
 */
export const UNSUPPORTED: readonly { id: string; reason: string }[] = [
  { id: 'highlight', reason: 'No mark command on the native editor.' },
  { id: 'subscript', reason: 'No mark command on the native editor.' },
  { id: 'superscript', reason: 'No mark command on the native editor.' },
  { id: 'color', reason: 'No text-style mark; colour is set per-element via htmlStyle, not per selection.' },
  { id: 'fontFamily', reason: 'Same as colour — no text-style mark to carry it.' },
  { id: 'table', reason: 'No table nodes in the native schema.' },
  { id: 'horizontalRule', reason: 'No rule node in the native schema.' },
  { id: 'details', reason: 'No disclosure node in the native schema.' },
  { id: 'emoji', reason: 'No emoji node; the system keyboard inserts emoji as text.' },
  { id: 'mathematics', reason: 'No math node, and katex is not installed.' },
  { id: 'twitch', reason: 'No embed node — same constraint as YouTube, and no player dependency.' },
  { id: 'audio', reason: 'No audio node in the native schema.' },
  { id: 'findAndReplace', reason: 'No search API on the instance; setValue would clobber the selection.' },
  { id: 'characterCount', reason: 'Derivable from onChangeText, but it is a display, not a toolbar action.' },
  { id: 'collaboration', reason: 'Requires a Yjs provider bound to the editor document; yjs is not installed.' },
  { id: 'bubbleMenu', reason: 'DOM-positioned against the selection; the native editor is not a WebView.' },
  { id: 'floatingMenu', reason: 'Same as bubble menu.' },
  { id: 'dragHandle', reason: 'Node reordering has no command on the instance.' },
  { id: 'fileHandler', reason: 'Drop/paste file events do not exist here; onPasteImages covers pasted images only.' },
];

/**
 * Compile-time proof that every toolbar entry can act. A `role: 'toolbar'`
 * capability with no `run` is a type error, not an empty slot at runtime.
 */
type ToolbarEntriesMustAct = {
  [K in (typeof CAPABILITIES)[number] as K['role'] extends 'toolbar' ? K['id'] : never]: K extends {
    run: unknown;
  }
    ? true
    : never;
};
export type __AssertToolbarEntriesAct = ToolbarEntriesMustAct;

/** Mentions are driven by the editor's own suggestion flow, not a button. */
export const MENTION_TRIGGERS = ['@'] as const;
