import type { Ref } from 'react';
import type { SplitHostProps } from 'expo-router/unstable-split-view';

/**
 * Everything here is derived from the installed `SplitHostProps`, never
 * retyped. `expo-router/split-view` re-exports that type from
 * `react-native-screens/experimental`
 * (expo-router/build/split-view/index.d.ts), so deriving from it adds no
 * dependency on react-native-screens.
 *
 * NOTE the specifier: SDK 57's expo-router publishes NO `exports` field, so the
 * root `unstable-split-view.js` is the entry. The SDK 58 canary is the opposite
 * — it declares `./split-view` in an exports map and the root file is then
 * unreachable. Flip this if the SDK moves again.
 */

type RefTarget<TRef> = TRef extends Ref<infer TTarget> ? TTarget : never;

/** `'primary' | 'supplementary' | 'secondary'` */
export type SplitNavigableColumn = NonNullable<SplitHostProps['topColumnForCollapsing']>;

/** `{ show: (column: SplitNavigableColumn) => void }` */
export type SplitViewCommands = RefTarget<NonNullable<SplitHostProps['ref']>>;

/**
 * Props the Android implementation can genuinely honour.
 *
 * Everything else on `SplitHostProps` is UISplitViewController surface with no
 * Android equivalent (`preferredDisplayMode`, `preferredSplitBehavior`,
 * `primaryEdge`, `displayModeButtonVisibility`, `showSecondaryToggleButton`,
 * `presentsWithGesture`, `orientation`, `colorScheme`, and the
 * `onDisplayModeWillChange` / `onInspectorHide` callbacks). Those stay
 * accepted-and-ignored on Android rather than being dropped from the type, so
 * a single call site compiles on both platforms — each is marked below.
 */
export type SplitViewProps = Pick<
  SplitHostProps,
  'children' | 'topColumnForCollapsing' | 'showInspector' | 'columnMetrics' | 'ref'
> &
  Omit<
    SplitHostProps,
    'children' | 'topColumnForCollapsing' | 'showInspector' | 'columnMetrics' | 'ref'
  >;

/**
 * The subset with real Android behaviour, for internal use by the adaptive
 * implementation. Kept separate so the public surface stays byte-identical
 * with iOS while the implementation only reads what it can act on.
 *
 * `columnMetrics` is honoured only for its minimum widths; Android pane widths
 * come from --container-pane-* tokens, so preferred/maximum are ignored.
 *
 * @platform android
 */
export interface AdaptiveSplitViewProps {
  children: SplitHostProps['children'];
  /** Which pane is visible once collapsed. Defaults to the leading column. */
  topColumnForCollapsing?: SplitHostProps['topColumnForCollapsing'];
  /** Rendered as a trailing pane where width allows; no layout space below that. */
  showInspector?: SplitHostProps['showInspector'];
  onCollapse?: SplitHostProps['onCollapse'];
  onExpand?: SplitHostProps['onExpand'];
  ref?: SplitHostProps['ref'];
}
