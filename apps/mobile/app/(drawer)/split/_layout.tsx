'use client';
import { Link } from 'solito/link';
import { SplitView } from '@/src/navigation/split-view';
import { PaneToggle } from '@/src/navigation/split-view/PaneToggle';
import { PaneSearchBar } from '@/src/navigation/split-view/PaneSearchBar';
import { SwipeableRow } from '@/src/navigation/split-view/SwipeableRow';
import { PaneListHeader } from '@/src/navigation/split-view/PaneListHeader';
import { useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { createStore, useStore } from 'zustand';
import { DetailNavbar } from '@/src/navigation/split-view/DetailNavbar';
import { SidebarSection } from '@/src/navigation/split-view/SidebarSection';
import { usePaneVisibility } from '@/src/navigation/split-view/use-pane-visibility';
import { isCollapsed, windowSizeClassForWidth } from '@/src/navigation/split-view/constants';
import { EventActionsSheet } from '../../../components/EventActionsSheet';
import { useStickyHeader } from '@/src/navigation/split-view/use-sticky-header';
import { PANE_WIDTH_DP } from '@/src/navigation/split-view/pane-widths';
import { usePaneSearch } from '@/src/navigation/split-view/pane-search.store';
import { Pressable, View, Text } from '@acme/ui/tw';
import { Avatar, Badge, EmptyState, IconButton, KeyboardAwareScroll, Menu, SafeArea, SegmentedControl } from '@acme/ui';
import { Header } from '@acme/ui/primitives';
import { Calendar, MoreHorizontal, Users } from '@acme/ui/icons';
import {
  DEMO_DAY,
  DEMO_RESOURCES,
  MenuButton,
  MiniCalendar,
  formatTimeRange,
  useScheduleStore,
  useProfile,
} from '@acme/app';

/**
 * Adaptive split view demo.
 *
 * The columns are ordinary app-authored JSX; only the detail pane comes from
 * the router, which is what lets the Android implementation lay this out
 * without rendering multiple file-based routes concurrently.
 *
 * The inspector is driven by SELECTION, not by a static flag: `showInspector`
 * is true only while a schedule event is selected, so the drawer opens on tap
 * and closes from its own control. The split view itself stays generic — it
 * takes a boolean and knows nothing about schedules.
 */
/** Contextual actions for the selected event. */
const EVENT_ACTIONS = [
  { id: 'duplicate', title: 'Duplicate' },
  { id: 'reschedule', title: 'Reschedule' },
  { id: 'delete', title: 'Delete', destructive: true },
] as const;

/** Theme options, mirroring the Settings screen's own control. */
const THEMES = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

/** Sidebar disclosure + action-sheet state. Per-screen, so per-instance. */
function createActionsStore() {
  return createStore<{
    open: boolean;
    set: (open: boolean) => void;
    instructors: boolean;
    setInstructors: (open: boolean) => void;
    appearance: boolean;
    setAppearance: (open: boolean) => void;
  }>((set) => ({
    open: false,
    set: (open) => set({ open }),
    instructors: true,
    setInstructors: (instructors) => set({ instructors }),
    appearance: false,
    setAppearance: (appearance) => set({ appearance }),
  }));
}

export default function SplitLayout() {
  const selectedEventId = useScheduleStore((state) => state.selectedEventId);
  const selectEvent = useScheduleStore((state) => state.selectEvent);

  const selectedDate = useScheduleStore((state) => state.selectedDate);
  const selectDate = useScheduleStore((state) => state.selectDate);
  const visibleMonth = useScheduleStore((state) => state.visibleMonth);
  const showMonth = useScheduleStore((state) => state.showMonth);

  const activeDate = selectedDate ? new Date(selectedDate) : DEMO_DAY.dayStart;
  const month = visibleMonth ? new Date(visibleMonth) : activeDate;

  // Filtering reads the DEBOUNCED query, not the draft: re-filtering on every
  // keystroke would rebuild the roster faster than it can be read.
  const { query: staffQuery } = usePaneSearch('supplementary');
  // Hiding a row reuses the store's existing resourceFilter, which the grid
  // already reads — the swipe drives a real feature rather than a demo toggle.
  const resourceFilter = useScheduleStore((state) => state.resourceFilter);
  const setResourceFilter = useScheduleStore((state) => state.setResourceFilter);
  // Auto-hiding title bar for the list pane. Reanimated drives it because it
  // is scroll-linked; see use-sticky-header for the Animated/Reanimated split.
  const listHeader = useStickyHeader();
  // The action sheet is a peer of the split view, not a child of the inspector:
  // it must overlay the whole screen, and on compact the inspector itself is
  // the only visible pane.
  const actionsStore = useRef<ReturnType<typeof createActionsStore> | null>(null);
  actionsStore.current ??= createActionsStore();
  const actionsOpen = useStore(actionsStore.current, (state) => state.open);
  const setActionsOpen = (open: boolean) => actionsStore.current?.getState().set(open);
  const instructorsOpen = useStore(actionsStore.current, (state) => state.instructors);
  const setInstructorsOpen = (open: boolean) =>
    actionsStore.current?.getState().setInstructors(open);
  const appearanceOpen = useStore(actionsStore.current, (state) => state.appearance);
  const setAppearanceOpen = (open: boolean) =>
    actionsStore.current?.getState().setAppearance(open);

  // The sidebar's own step down to a rail, resolved by the same rule the layout
  // uses so the two can never disagree about which mode is showing.
  const { primaryNarrow: rail } = usePaneVisibility(2);
  const compact = isCollapsed(windowSizeClassForWidth(useWindowDimensions().width));
  const theme = useProfile((state) => state.theme);
  const setTheme = useProfile((state) => state.setTheme);
  const toggleResource = (resourceId: string) => {
    const shown =
      resourceFilter.length === 0
        ? DEMO_RESOURCES.map((resource) => resource.id)
        : resourceFilter;
    const next = shown.includes(resourceId)
      ? shown.filter((id) => id !== resourceId)
      : [...shown, resourceId];
    // Everything visible again is stored as "no filter", so a later roster
    // change is not silently excluded by a stale list of ids.
    setResourceFilter(next.length === DEMO_RESOURCES.length ? [] : next);
  };
  const staff = staffQuery
    ? DEMO_RESOURCES.filter((resource) =>
        resource.name.toLowerCase().includes(staffQuery.toLowerCase()),
      )
    : DEMO_RESOURCES;

  const selectedEvent = DEMO_DAY.events.find((event) => event.id === selectedEventId);
  const eventResource = DEMO_RESOURCES.find(
    (resource) => resource.id === selectedEvent?.resourceId,
  );

  return (
    <SafeArea edges={['top']} className="flex-1">
      {/*
        The drawer navigator runs with headerShown:false, and SplitView fills
        the screen — so without this row there is no title and no way back to
        the drawer from the schedule.
      */}
      <Header className="flex-row items-center gap-3 border-b-2 border-border bg-primary px-4 py-3">
        <MenuButton />
        <Text className="flex-1 text-lg font-semibold text-on-primary md:text-xl lg:text-2xl">Schedule</Text>
        {/* A control that hides a pane cannot live inside that pane, or there
            is no way back. Both sit in the screen header; the inspector's is in
            its own chrome because selection reopens it anyway. */}
        <PaneToggle pane="primary" columnCount={2} />
        <PaneToggle pane="supplementary" columnCount={2} />
        {/* The inspector's toggle belongs here too. It lived inside the
            inspector, which meant hiding it left no way to bring it back —
            the override outlives the session in MMKV, so selecting an event
            silently did nothing. A control that hides a pane can never live
            inside that pane. */}
        <PaneToggle pane="inspector" columnCount={2} />
      </Header>

      <SplitView topColumnForCollapsing="primary" showInspector={selectedEvent != null}>
      <SplitView.Column>
        <View className="flex-1 gap-4 bg-surface p-3">
          {/* RAIL MODE: at medium widths the primary pane steps down to 16rem
              before it disappears. Labels are dropped rather than truncated —
              a clipped word reads as a bug, an icon reads as a rail. */}
          <Link href="/split">
            <View
              className={`flex-row items-center gap-2 rounded-md border-2 border-border bg-primary py-2 shadow-card ${
                rail ? 'justify-center px-2' : 'px-3'
              }`}
            >
              <View className="h-2 w-2 rounded-full bg-on-primary" />
              {rail ? null : (
                <Text className="text-sm font-semibold text-on-primary md:text-base">Today</Text>
              )}
            </View>
          </Link>

          <SidebarSection
            label="Instructors"
            open={instructorsOpen}
            onOpenChange={setInstructorsOpen}
            rail={rail}
          >
            {DEMO_RESOURCES.map((resource) => (
              <View
                key={resource.id}
                className={`flex-row items-center gap-2 py-1.5 ${rail ? 'justify-center' : 'px-1'}`}
              >
                <Avatar
                  size="sm"
                  className="md:h-11 md:w-11"
                  name={resource.name}
                  imageUri={resource.avatarUrl}
                />
                {rail ? null : (
                  <Text numberOfLines={1} className="flex-1 text-sm text-text md:text-base">
                    {resource.name}
                  </Text>
                )}
              </View>
            ))}
          </SidebarSection>

          {/* Persistent footer: theme switching lives with the workspace, not
              buried in Settings, because it is a view preference for THIS
              surface. Hidden in rail mode, where there is no room for three
              labelled segments. */}
          <View className="flex-1" />
          {rail ? null : (
            <SidebarSection
              label="Appearance"
              open={appearanceOpen}
              onOpenChange={setAppearanceOpen}
            >
              <SegmentedControl options={THEMES} value={theme} onChange={setTheme} />
            </SidebarSection>
          )}
        </View>
      </SplitView.Column>

      <SplitView.Column>
        {/* Keyboard-aware because this pane hosts the search field: without it
            the field ends up under the keyboard, with its clear button pinned
            against the keyboard's edge. */}
        <PaneListHeader
          title="Studio"
          subtitle={`${staff.length} ${staff.length === 1 ? 'person' : 'people'}`}
          header={listHeader}
        >
          <PaneToggle pane="supplementary" columnCount={2} />
        </PaneListHeader>

        <KeyboardAwareScroll
          className="flex-1 bg-surface-raised"
          // Top padding clears the absolutely-positioned header, which sits
          // outside the flow so retracting it does not reflow the list.
          contentContainerClassName="gap-4 p-4 pt-20"
          bottomOffset={24}
          keyboardShouldPersistTaps="handled"
          onScroll={listHeader.scrollHandler}
          scrollEventThrottle={16}
        >
          {/* Month grid drives which day the schedule shows — the same role it
              plays in the reference, and it doubles as the month picker. */}
          <MiniCalendar
            month={month}
            selected={activeDate}
            today={DEMO_DAY.dayStart}
            onSelect={(date) => selectDate(date.toISOString())}
            onMonthChange={(next) => showMonth(next.toISOString())}
          />

          <Text className="text-xs font-semibold uppercase text-text-muted md:text-sm">Staff</Text>

          {/* The pane composes its own field — see PaneSearchBar for why this
              is composition rather than a `searchable` flag. */}
          <PaneSearchBar
            pane="supplementary"
            placeholder="Search staff"
            resultCount={staff.length}
          />

          {/* STATES — every one, not just the happy path. An empty result from
              a search is a different situation from an empty roster, and both
              are different from "everyone is hidden". */}
          {staff.length === 0 ? (
            <EmptyState
              icon={<Users className="text-text-muted" />}
              title={staffQuery ? 'No matches' : 'No staff yet'}
              description={
                staffQuery
                  ? `No one matches “${staffQuery}”.`
                  : 'Add someone to the studio to see them here.'
              }
            />
          ) : null}

          {staff.map((resource) => {
            const hidden = resourceFilter.length > 0 && !resourceFilter.includes(resource.id);
            return (
              <SwipeableRow
                key={resource.id}
                rowWidth={PANE_WIDTH_DP.supplementary}
                onCommit={() => toggleResource(resource.id)}
                actions={
                  <Pressable
                    aria-label={hidden ? `Show ${resource.name}` : `Hide ${resource.name}`}
                    onPress={() => toggleResource(resource.id)}
                    className="h-full w-full items-center justify-center bg-accent"
                  >
                    <Text className="text-xs font-semibold text-on-accent">
                      {hidden ? 'Show' : 'Hide'}
                    </Text>
                  </Pressable>
                }
              >
                <View
                  className={`flex-row items-center gap-2 bg-surface-raised py-1 ${
                    hidden ? 'opacity-40' : ''
                  }`}
                >
                  <Avatar
                    size="sm"
                    className="md:h-11 md:w-11"
                    name={resource.name}
                    imageUri={resource.avatarUrl}
                  />
                  <Text numberOfLines={1} className="flex-1 text-sm text-text md:text-base">
                    {resource.name}
                  </Text>
                  {hidden ? (
                    <Text className="text-xs text-text-muted">Hidden</Text>
                  ) : null}
                </View>
              </SwipeableRow>
            );
          })}

          {/* End of list — tells the reader the roster stopped rather than
              leaving them unsure whether more is loading. */}
          {staff.length > 0 ? (
            <Text className="py-2 text-center text-xs text-text-muted md:text-sm">
              {staff.length} {staff.length === 1 ? 'person' : 'people'} · swipe a row to hide
            </Text>
          ) : null}
        </KeyboardAwareScroll>
      </SplitView.Column>

      <SplitView.Inspector>
        <View className="flex-1 gap-3 bg-surface p-4">
          <DetailNavbar title="Details" onDismiss={() => selectEvent(null)}>
            {selectedEvent ? (
              /* An ANCHORED menu, not the ⋯-opens-a-bottom-sheet pattern this
                 started as: on a tablet the sheet rose from the far edge of a
                 1280dp screen, nowhere near the button that summoned it. The
                 sheet is kept for compact width, where the trigger really is
                 near the bottom — see EventActionsSheet below. */
              <Menu
                title={selectedEvent.title}
                actions={EVENT_ACTIONS}
                onAction={(id) => {
                  if (id === 'delete') selectEvent(null);
                }}
              >
                {/* NOT an IconButton: MenuView wraps its child in its own
                    Pressable to open the menu, so a pressable trigger swallows
                    the touch and nothing happens. This is the same box, drawn
                    without its own press handling. */}
                <View
                  aria-label="Event actions"
                  className="h-11 w-11 items-center justify-center rounded-md"
                >
                  <MoreHorizontal size={20} className="text-text-muted" />
                </View>
              </Menu>
            ) : null}
          </DetailNavbar>

          {selectedEvent ? (
            <>
              <Text className="text-lg font-semibold text-text md:text-xl lg:text-2xl">{selectedEvent.title}</Text>
              <Text className="text-sm text-text-muted md:text-base">
                {formatTimeRange(selectedEvent, DEMO_DAY.timeZone)}
              </Text>
              {eventResource ? (
                <View className="flex-row items-center gap-2 pt-1">
                  <Avatar size="sm" className="md:h-11 md:w-11" name={eventResource.name} imageUri={eventResource.avatarUrl} />
                  <Text className="text-sm text-text md:text-base">{eventResource.name}</Text>
                </View>
              ) : null}
              <Badge label={selectedEvent.kind} />
            </>
          ) : (
            /* REQUIRED, not optional: at expanded widths this pane is on screen
               with nothing selected on first launch, so without this it is a
               titled empty box that looks broken. */
            <EmptyState
              icon={<Calendar className="text-text-muted" />}
              title="Nothing selected"
              description="Pick a booking in the schedule to see its details here."
            />
          )}
        </View>
      </SplitView.Inspector>
      </SplitView>

      {/* Compact only: at that width the detail pane fills the screen and its
          toolbar sits at the top, so a sheet rising from the bottom is the
          reachable target. Wider layouts use the anchored menu above. */}
      {selectedEvent && compact ? (
        <EventActionsSheet
          open={actionsOpen}
          onClose={() => setActionsOpen(false)}
          eventTitle={selectedEvent.title}
          onDuplicate={() => {}}
          onReschedule={() => {}}
          onDelete={() => selectEvent(null)}
        />
      ) : null}
    </SafeArea>
  );
}
