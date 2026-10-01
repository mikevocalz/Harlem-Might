# Adaptive Split View (Android) + Schedule Calendar

`expo-router`'s split view is iOS-only. It wraps `Split` from
`react-native-screens/experimental`, which wraps `UISplitViewController`. On any
non-iOS platform it warns and renders `<Slot />`, and downstream
`react-native-screens` ships `SplitHost.android.tsx` / `SplitScreen.android.tsx`
as warn-and-return-null stubs with no Kotlin behind them.

So Android parity here is an **app-layer adaptive layout, not a native bridge**.

The call site is byte-identical across platforms:

```tsx
import { SplitView } from '@/src/navigation/split-view';

<SplitView topColumnForCollapsing="primary" showInspector>
  <SplitView.Column>{/* sidebar */}</SplitView.Column>
  <SplitView.Column>{/* supplementary list */}</SplitView.Column>
  <SplitView.Inspector>{/* inspector */}</SplitView.Inspector>
</SplitView>
```

`index.ios.tsx` re-exports expo-router's implementation untouched;
`index.android.tsx` is the adaptive one. Metro picks the fork.

## Breakpoints

Material 3 Adaptive width classes, in dp, from `constants.ts`. Nothing else in
the module names a number.

| Class | Min width |
|---|---|
| `compact` | 0 |
| `medium` | 600 |
| `expanded` | 840 |
| `extraLarge` | 1200 |

Widths come from `--container-pane-*` tokens in `packages/theme/tokens.ts`, so
panes are sized by `w-pane-primary` and friends rather than arbitrary values.

## Visibility policy

`columnCount` is the number of authored `SplitView.Column` children.

**Two-pane shape (1 column + detail)**

| Size class | primary | supplementary | inspector | detail |
|---|---|---|---|---|
| extraLarge | full | — | yes | flex |
| expanded | full | — | yes | flex |
| medium | narrow rail | — | no | flex |
| compact | single pane only | — | no | single pane only |

**Three-pane shape (2 columns + detail)**

| Size class | primary | supplementary | inspector | detail |
|---|---|---|---|---|
| extraLarge | full | yes | yes | flex |
| expanded | narrow rail | yes | no | flex |
| medium | hidden | yes | no | flex |
| compact | single pane only | single pane only | no | single pane only |

At `compact` exactly one pane renders. The inspector occupies **no layout
space** below `expanded` — it is not rendered zero-width.

## iOS / Android divergences

| Behaviour | iOS | Android |
|---|---|---|
| `show(column)` | `UISplitViewController.show(_:)`; can overlay a hidden sidebar while expanded | Swaps the pane when collapsed. Visual no-op when expanded, but the column is recorded so a later collapse lands there |
| Column presentation | `displace` / `overlay` / `tile` per `preferredSplitBehavior` | Always tiled. There is no overlay presentation |
| `preferredDisplayMode`, `preferredSplitBehavior`, `primaryEdge`, `displayModeButtonVisibility`, `showSecondaryToggleButton`, `presentsWithGesture`, `orientation`, `colorScheme` | honoured | accepted and ignored — typed as `@platform ios` so a shared call site still compiles |
| `onDisplayModeWillChange`, `onInspectorHide` | fire | never fire — there are no display modes and no modal inspector |
| `columnMetrics` | full min/max/preferred | ignored; widths are tokens |
| Safe area | `SplitView.Column` wraps `SafeAreaProvider`; `Inspector` does not | the pane row applies `edges={['left','right']}`, which is where landscape tablets break |
| Column count changes | `Split.Host` is keyed on child count and remounts | same remount semantics, by construction |

Diagnostics match iOS exactly: more than two `SplitView.Column` **throws**, foreign
children warn, zero children warn and fall back to `<Slot />`.

### Web

`apps/web` does not depend on `expo-router`, so this module is native-only and
is not imported there. Note that expo-router's own guard is
`process.env.EXPO_OS !== 'ios'`, not `Platform.OS`; `packages/ui/rn-globals-shim.ts`
sets `EXPO_OS = 'web'`, so if the upstream component ever were imported on web it
would warn once and render `<Slot />` rather than crash.

## Back behaviour

Order: pop within the detail pane's stack → step back one column → fall through.

Two implementation notes that are easy to get wrong:

1. **Subscription ordering is inherited, not arranged.** `BackHandler.android.js`
   walks `_backPressSubscriptions` last-registered-first and stops at the first
   handler returning `true`. expo-router's navigation container mounts *above*
   the split view, so it subscribes *earlier* and runs *after* this handler.
   Returning `false` is therefore what hands the press down to it. We never call
   `router.back()` ourselves — that would double-pop by racing the container.

2. **Predictive back is off in this app.** `AndroidManifest.xml` has
   `android:enableOnBackInvokedCallback="false"`, so the legacy `hardwareBackPress`
   path is authoritative. If that is ever flipped to `true`, `useSplitViewBack`
   must move to `onBackInvokedCallback`, because the legacy event stops firing.

**Deliberate refinement:** the stack pop is scoped to when the detail pane is the
visible one. Popping unconditionally would, while the sidebar is showing, spend a
Back press mutating a stack the user cannot see — a press that looks dead. Tested
in `split-view.test.ts`.

Column position lives in Zustand (`store.ts`), not `useState`, so compact ⇄
expanded ⇄ compact returns to the same column. The detail route is owned by
expo-router and is unaffected by the layout switch.

## Schedule calendar

Lives in `packages/app/features/schedule` and knows nothing about the split
view — it reads the window size class exactly as it would if it were the only
thing on screen.

- **Resource-major.** Columns are resources; the date is fixed. That inverts the
  usual date-column calendar and is why the axis that grows is resources.
- **Times are instants + an explicit IANA zone.** Wall-clock placement goes
  through `Intl.DateTimeFormat` with `hourCycle: 'h23'`. No date library. The
  reverse direction (wall clock → instant) is deliberately *not* done in the UI;
  `ScheduleDay.dayStart` is supplied by the data layer, because that direction is
  ambiguous twice a year.
- **Overlap lanes are two-stage.** Greedy interval colouring assigns the lane;
  then events are grouped into transitively-connected clusters and every event in
  a cluster shares one `laneCount`. Sizing per-event instead would give two
  non-touching short events different widths under one long spanning event, and
  the blocks would not line up.
- **Accent belongs to the resource, never the event.** Accent classes are spelled
  out literally in `accent-classes.ts` because Tailwind scans source as text —
  `bg-${accent}-500` is never emitted.

### Compact fallback — decision

At compact the resource day grid is **replaced**, not squeezed, by the booking
surface: a one-week date strip over a vertical list of time slots with a
full-width primary action.

Rationale: several proportional-height columns on a phone gives each appointment
a few characters of width and turns reading the day into a horizontal-scroll
puzzle. The alternative considered was a single-resource agenda list. The booking
surface won because it matches the task a phone user actually has — pick a day,
pick a time — and it degrades to a genuinely useful screen rather than a worse
version of the grid.

### Known limits

- **One scroll per axis.** A horizontally-pinned time gutter *and* a vertically
  sticky resource header cannot coexist under a single pair of scroll views; one
  must be driven from the other's offset. That synchronization is a UI-thread
  Reanimated concern whose smoothness can only be judged on a device, so it was
  not shipped on an unmeasured guess. Today the resource header is sticky
  vertically and the gutter shares the body's vertical scroll by construction, so
  neither axis can drift; the gutter scrolls horizontally once resources overflow.
  Upgrade path: `useAnimatedRef` + `useScrollViewOffset` + `scrollTo` in a
  `useAnimatedReaction`, measured on device.
- **Resources are not virtualized.** Resource counts here are bounded (tens, not
  thousands), so a plain scroll container costs less than a windowing pass.
  `@legendapp/list` is the swap-in if a deployment exceeds ~50 columns.
  Note `@shopify/flash-list` is **not** installed; this repo standardises on
  `@legendapp/list`.
- **No frame-budget numbers.** The optimization gate requires measured before/after
  FPS or TTI. None were taken — no device was driven in this pass — so no
  performance claim is made here at all.
- **Pinch-to-zoom is not implemented.** Zoom is discrete via `HOUR_HEIGHT_STEPS`.
- **The divider's drag is unverified on a device.** The resize POLICY is pure and
  tested (`resize.ts`, clamping/rounding/origin-resolution); the pan itself has
  never been driven by a finger. Treat the gesture as unproven until it is.

## Phase 7 status

| Item | State |
|---|---|
| Divider affordance | drag + keyboard implemented; policy tested, **drag unverified on device** |
| Pane enter/exit on collapse | implemented, transform-only, direction-aware; **unverified on device** |
| Calendar reschedule | policy tested and **wired to the keyboard** (Arrow Up/Down on a focused event nudges by 15 min). A touch DRAG is deliberately not wired — see below |
| Focus / keyboard on events | done on web: event blocks are real `<button>`s and reschedule from the keyboard |
| Focus traversal between panes | **not implemented** |

Reschedule is driven from the keyboard rather than a pan gesture on purpose:
a gesture would pull `react-native-gesture-handler` into `packages/app`, which
the Next app bundles and does not list in `transpilePackages` — risking the only
surface in this repo that can currently be verified end to end. The move policy
is shared, so wiring a drag later reuses `rescheduleByMinutes` unchanged.
Moves are layered as `overrides` keyed by event id and applied at read time, so
the source day data stays immutable and a move can be discarded by dropping the
override.

The pane transition is keyed on the active column and travels according to
`COLUMN_RANK`, so Back visually reverses forward navigation. It animates
`x` only — never opacity from 0 — so a stalled animation leaves a readable pane
instead of a blank screen.

`reschedule.ts` preserves duration when clamping: a drag past the end of the day
moves the whole block so it ends at the boundary rather than trimming a
60-minute lesson to 20. An event longer than the visible day pins to the start
instead of taking a negative offset. Both are tested.

## Gesture arbitration

There is nothing to arbitrate, and that is a property of the design rather than
luck. The split view has exactly one horizontal recognizer — the pane divider —
and it is confined to its own hit area. Collapse is derived from the window size
class, column stepping comes from Back, and the calendar's horizontal scroll
lives inside the detail pane. Two recognizers that can never receive the same
pointer do not need a race.

The rule that preserves this: **the divider must not grow its hit slop into the
detail pane.** If it ever needs a larger target, or if swipe-to-collapse is
added, the divider's pan genuinely competes with the calendar's scroll for the
same pointer and must be composed with `useCompetingGestures`, with the decision
written down here.

Note the API: Expo SDK 57 pins Gesture Handler **2.x**, so the builder API
(`Gesture.Pan()` + `GestureDetector`) is current here and composition is
`Gesture.Race()` / `Gesture.Simultaneous()`. GH 3.x flips this — it deprecates
the builder in favour of `usePanGesture` and the `use*Gestures` hooks. Check the
installed version before writing gesture code.

## Styling rules

Tailwind classes only — no `StyleSheet`, no hex literals, no inline `style` for
appearance. The single documented exception is **computed geometry**: `top`,
`height`, `left`, `width` derived from time math may be passed numerically
(`geometry.ts`), and may never carry a colour, radius, border or spacing value.

State is Zustand. There is no `useState` in this module or the schedule feature.

## Testing

`node --test` with `node:assert` — zero test dependencies. Node 24 strips
TypeScript natively, so `.test.ts` runs directly.

```
pnpm --filter mobile test    # split view: size classes, visibility, back policy
pnpm --filter @acme/app test # schedule: zones/DST, lanes, geometry, slots
```

Testable logic is kept in modules with no `react-native` import so it stays
runnable under plain node.

## Prior art

- [`craftzdog/inkdrop-ui-mockup-react-native`](https://github.com/craftzdog/inkdrop-ui-mockup-react-native)
  (Apache-2.0) — collapse choreography as widths change. No code lifted.
- [`craftzdog/react-native-three-column-layout`](https://github.com/craftzdog/react-native-three-column-layout)
  (MIT) — fixed leading widths with a flexible trailing pane. Its render-prop +
  imperative `*Visible` API was **rejected**: visibility here is derived from the
  window size class and children are JSX. Not added as a dependency.
- reactnativecomponents.com "Solid Calendar" — time-grid mechanics. Its columns
  are dates and it has no overlap handling; both gaps are closed above. Its
  `@react-navigation/drawer` prerequisite is not installed.

---

## Pane visibility: automatic policy vs manual overrides

Two things decide whether a pane is on screen, and they disagree unless the
precedence is written down. It is `resolvePaneVisibility` in
`pane-overrides.ts`, and it is pure so every combination is unit-tested before
it reaches a component (`pane-overrides.test.ts`).

1. `paneVisibility(sizeClass, columnCount)` computes the DEFAULT for the current
   size class.
2. An override recorded for THIS size class replaces that default.
3. An override recorded for a DIFFERENT size class is ignored. Crossing a
   breakpoint lands on the new class's own default unless it too has one — so
   hiding the list on a tablet does not hide it on a phone, where it is the only
   thing on screen.
4. Overrides persist in **MMKV**, instance id `split-view`, key
   `pane-overrides`, as a JSON blob of the size-class-keyed map
   (`pane-overrides.store.ts`). MMKV reads synchronously, so the first render
   already knows the answer and no pane flashes open before an async read
   resolves. A malformed blob is discarded rather than left to strand a pane.
5. An override can always HIDE a pane, but can only SHOW one the size class can
   physically fit (`canShow`). Compact shows exactly one pane and the navigator
   owns which, so nothing there is user-togglable; medium fits the primary rail
   beside the detail, but not a third column.

`primaryNarrow` — the rail step — is derived, never toggled: a hidden pane is
not narrow, it is absent.

## Animation boundary: Reanimated vs Legend Motion

Both systems are in this app deliberately, and the split is by KIND of
animation, never mixed inside one component.

| System | Owns | Why |
|---|---|---|
| **Reanimated** (+ Gesture Handler) | sticky header, event drag, swipeable rows | Anything tracking a finger or a scroll offset must update every frame on the UI thread. |
| **Legend Motion** | pane show/hide, inspector drawer, chevron rotation, entrances | Declarative state transitions. Zero-dependency, built on RN `Animated`. |

Legend Motion is built on React Native's `Animated`, not Reanimated, and RN
cannot mix native-driven and JS-driven properties on one component — so neither
can Legend Motion. Native-driven: `opacity`, `x`, `y`, `scale`, `rotate` and
friends. Everything else — `width`, `flexBasis`, colours — is JS-driven.

That is why `CollapsiblePane` animates **width and nothing else** on its own
node, with the pane's content on a separate inner view. Width is the deliberate
choice over a native-driven `translateX`: sliding the pane out would leave its
width in the layout, so the detail pane would keep its old size and a blank
strip would sit where the pane used to be. Neighbours have to reflow, and only
an animated width makes them do it continuously.

Moti is the Reanimated-backed alternative with a similar API if we ever want one
system; it is deliberately not installed.

## Transition tokens

Named in `transitions.ts`; no inline transition literals anywhere.

| Token | Shape | Drives |
|---|---|---|
| `paneSlide` | spring, damping 28, stiffness 260 | Pane translateX (native-driven) |
| `paneWidth` | timing 220ms easeInOut | Pane width — a TWEEN, because a spring on width reflows every neighbour on each overshoot frame |
| `paneContent` | timing 160ms easeOut | Content fade/slide inside a pane |
| `disclosure` | timing 180ms easeInOut | Chevron / toggle rotation |
| `selection` | timing 140ms easeOut | Selected-row colour |

## Back priority chain

`resolveSearchBack` in `pane-search.ts`, applied by `use-split-view-back.ts`.
Highest first:

1. Focused search with a non-empty query → **clear the query**, keyboard stays.
2. Focused search with an empty query → **blur**.
3. Detail pane showing with a poppable stack → **defer** to the navigator.
4. Collapsed split view not on the leading column → **step back one column**.
5. Nothing left → **fall through** to the system.

1 and 2 outrank navigation because the keyboard is the most recent thing the
user opened and Back undoes the most recent thing; splitting them into two
presses means a mistyped query costs one press to fix rather than ejecting the
user from the field. The clear decision reads the DRAFT, not the debounced
query, so Back still empties a field typed within the debounce window.

Search focus also gates horizontal gestures (`horizontalGesturesEnabled`): while
a field holds focus the drawer swipe is disabled, because a horizontal drag near
the edge is also how you move the caret.

## Search

Panes COMPOSE `PaneSearchBar` rather than taking a `searchable` flag. A boolean
would make the pane own the placeholder, result count and field placement, none
of which the split view can know — and composition gives "no layout space when
absent" for free, since a pane that does not render it has nothing to reserve.

State is one slice per pane in `pane-search.store.ts`: a global query would leak
one pane's filter into the other's list, which at expanded widths is the normal
case. Debounce is owned by `PaneSearchBar`, not delegated to the kit's
`SearchBar` — that component debounces `onChangeText` and keeps the instant text
internally, which would make the store's draft lag the field.

## Swipeable rows

`swipe-actions.ts` (pure, tested) + `SwipeableRow.tsx`. Two thresholds:

- **Open** at half the action width — the row parks so the buttons can be tapped.
- **Commit** past 60% of the ROW width — far enough that peeking at the actions
  can never fire one by accident.

Velocity is considered before distance, so a quick flick commits even having
covered little ground, and a flick back always closes.

## Prior art

Behaviours reimplemented from
[craftzdog/inkdrop-ui-mockup-react-native](https://github.com/craftzdog/inkdrop-ui-mockup-react-native)
(Apache-2.0): the auto-hiding header (`use-sticky-header`), the gesture
arbitration on search focus (`use-drawer-enabled`), the fixed-inner-width trick
during a pane width animation (`three-column-layout`), and swipe-to-reveal rows
(`swipeable-view`). Nothing was copied — that project is React Navigation v6 +
jotai + Restyle + RN `Animated`; this is expo-router + Zustand + Legend Motion +
Reanimated.

Its `RESPONSIVE_SCREEN_BREAKPOINT = 1024` single boolean and its practice of
rendering different subtrees per size class were both rejected: this app uses
four Material window size classes and keeps ONE tree, so panes survive rotation
and multi-window resize with scroll position, selection and search intact.
