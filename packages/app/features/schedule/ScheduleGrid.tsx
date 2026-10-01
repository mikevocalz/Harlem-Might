'use client';
import { useCallback, useRef } from 'react';
import { View, Text, ScrollView } from '@acme/ui/tw';
import { createStore, useStore } from 'zustand';
import { Avatar } from '@acme/ui';
import { ACCENT_CLASSES } from './accent-classes.ts';
import { EventBlock } from './EventBlock.tsx';
import { formatHourLabel } from './format.ts';
import {
  MINUTES_PER_HOUR,
  HOUR_LABEL_OFFSET,
  HOUR_LABEL_TAIL,
  RESOURCE_COLUMN_WIDTH,
  TIME_GUTTER_WIDTH,
  currentTimeOffset,
  eventRect,
  gridHeight,
  hourRules,
} from './geometry.ts';
import { assignLanes } from './lanes.ts';
import { columnIdForEvent, columnsForView, eventsForView, type GridColumn } from './columns.ts';
import { applyOverrides, rescheduleByMinutes, rescheduleByOffset, SNAP_MINUTES } from './reschedule.ts';
import { EventDrag } from './event-drag';
import { zonedMinutesOfDay, type ScheduleDay } from './model.ts';
import { useScheduleStore } from './store.ts';

export interface ScheduleGridProps {
  day: ScheduleDay;
  /** Injected so the live rule is deterministic in tests and stories. */
  now: Date;
}

/**
 * Resource day grid: columns are resources, the date is fixed.
 *
 * SCROLL ARCHITECTURE — one scroll per axis, deliberately.
 * A horizontally-pinned time gutter AND a vertically-sticky resource header
 * cannot both exist under a single pair of scroll views; one of them has to be
 * driven from the other's offset. That synchronization is a UI-thread
 * Reanimated concern whose smoothness can only be judged on a device, so it is
 * not shipped here on an unmeasured guess. What is shipped: the resource header
 * is sticky vertically via `stickyHeaderIndices`, and the gutter shares the
 * body's vertical scroll by construction, so neither axis can drift. The gutter
 * scrolls horizontally with the grid once the resources overflow the viewport.
 * See README.md for the upgrade path.
 */
export function ScheduleGrid({ day, now }: ScheduleGridProps) {
  const hourHeight = useScheduleStore((state) => state.hourHeight);
  const selectedEventId = useScheduleStore((state) => state.selectedEventId);
  const selectEvent = useScheduleStore((state) => state.selectEvent);
  const resourceFilter = useScheduleStore((state) => state.resourceFilter);
  const overrides = useScheduleStore((state) => state.overrides);
  const view = useScheduleStore((state) => state.view);
  const moveEvent = useScheduleStore((state) => state.moveEvent);

  const visibleResources =
    resourceFilter.length === 0
      ? day.resources
      : day.resources.filter((resource) => resourceFilter.includes(resource.id));

  // Week view is one person across seven days; day view is every person on one
  // day. Both collapse to the same column list so everything downstream — lane
  // assignment, geometry, the header — is written once.
  const focusedResourceId = visibleResources[0]?.id;
  const columns: GridColumn[] =
    view === 'day'
      ? visibleResources.map((resource) => ({
          id: resource.id,
          label: resource.name,
          accent: resource.accent,
          resource,
        }))
      : columnsForView(day, view, focusedResourceId);

  const rules = hourRules(day);
  const bodyHeight = gridHeight(day, hourHeight);
  const currentEvents = applyOverrides(day.events, overrides);
  const events = eventsForView(day, currentEvents, view);
  const laneMap = new Map(
    columns.map((column) => [
      column.id,
      assignLanes(
        events.filter(
          (event) => columnIdForEvent(event, view, day.timeZone, focusedResourceId) === column.id,
        ),
      ),
    ]),
  );
  /**
   * ONE handler for every block, keyed by id — a per-event closure would be a
   * new reference each render and defeat EventBlock's memo comparator outright.
   * Resolved against `day.events` (the source), never the overridden copy, so
   * repeated nudges do not compound.
   */
  /**
   * The event's CURRENT position — source plus any pending override.
   *
   * Read from the store imperatively rather than closed over: measuring from
   * the pristine source made every move after the first recompute the same
   * offset (a second +15 landed on 9:15 again instead of 9:30), but closing
   * over the derived array would give these callbacks a new identity every
   * render and defeat EventBlock's memo. getState() gives correctness without
   * the subscription.
   */
  const resolveCurrent = useCallback(
    (eventId: string) => {
      const source = day.events.find((event) => event.id === eventId);
      if (!source) return undefined;
      const override = useScheduleStore.getState().overrides[eventId];
      return override ? { ...source, ...override } : source;
    },
    [day],
  );

  const handleNudge = useCallback(
    (eventId: string, deltaMinutes: number) => {
      const source = resolveCurrent(eventId);
      if (!source) return;
      const moved = rescheduleByMinutes({
        event: source,
        deltaMinutes,
        bounds: day,
        startMinutes: zonedMinutesOfDay(source.start, day.timeZone),
      });
      moveEvent(eventId, {
        start: moved.start,
        end: moved.end,
        resourceId: moved.resourceId,
      });
    },
    [resolveCurrent, day, moveEvent],
  );

  /** Commit a finished drag once, converting the pixel offset to a new time. */
  const handleDragCommit = useCallback(
    (eventId: string, deltaY: number) => {
      const source = resolveCurrent(eventId);
      if (!source) return;
      const moved = rescheduleByOffset({
        event: source,
        deltaPx: deltaY,
        hourHeight,
        bounds: day,
        startMinutes: zonedMinutesOfDay(source.start, day.timeZone),
      });
      moveEvent(eventId, {
        start: moved.start,
        end: moved.end,
        resourceId: moved.resourceId,
      });
      // Deliberately does NOT select: a drag is a move, not a selection, and
      // opening the details drawer mid-drag steals width from the grid you are
      // dragging in. Selection stays a tap.
    },
    [resolveCurrent, day, hourHeight, moveEvent],
  );

  const nowOffset = currentTimeOffset(now, day, hourHeight);

  // Columns STRETCH to fill a wide pane instead of leaving dead space beside a
  // fixed 184dp grid — collapsing the sidebar has to give its width to the
  // schedule, or the control does nothing visible. RESOURCE_COLUMN_WIDTH stays
  // the floor, so a narrow pane still scrolls horizontally rather than
  // squeezing columns to an unreadable width.
  // Per-instance vanilla store in a ref, not React state (repo rule). The grid
  // can appear more than once, so the measurement cannot live in a module
  // singleton either.
  const widthStore = useRef<ReturnType<typeof createWidthStore> | null>(null);
  widthStore.current ??= createWidthStore();
  const availableWidth = useStore(widthStore.current, (state) => state.width);
  const usableWidth = availableWidth - TIME_GUTTER_WIDTH;
  const columnWidth =
    columns.length > 0 && usableWidth > 0
      ? Math.max(RESOURCE_COLUMN_WIDTH, usableWidth / columns.length)
      : RESOURCE_COLUMN_WIDTH;
  const gridWidth = TIME_GUTTER_WIDTH + columns.length * columnWidth;

  return (
    <View
      className="flex-1 overflow-hidden rounded-sheet border border-border bg-surface-raised"
      onLayout={(event) => widthStore.current?.getState().measure(event.nativeEvent.layout.width)}
    >
      <ScrollView horizontal className="flex-1" contentContainerClassName="grow">
        <View style={{ width: gridWidth }} className="flex-1">
          <ScrollView
            className="flex-1"
            stickyHeaderIndices={[0]}
            showsVerticalScrollIndicator={false}
          >
            {/* Sticky resource header */}
            <View className="flex-row border-b border-border bg-surface-raised">
              <View style={{ width: TIME_GUTTER_WIDTH }} />
              {columns.map((column) => (
                <ColumnHeader key={column.id} column={column} width={columnWidth} />
              ))}
            </View>

            <View className="flex-row" style={{ height: bodyHeight + HOUR_LABEL_TAIL }}>
              {/* Time gutter — labels sit ON the hour rule, not centred in the slot */}
              <View style={{ width: TIME_GUTTER_WIDTH }}>
                {rules.map((hour, index) => (
                  <Text
                    key={hour}
                    // The first label would sit at -6 and be clipped by the sticky header.
                    style={{ top: Math.max(0, index * hourHeight - HOUR_LABEL_OFFSET) }}
                    className="absolute left-0 right-2 text-right text-xs font-normal text-text-muted md:text-sm"
                  >
                    {formatHourLabel(hour)}
                  </Text>
                ))}
              </View>

              {columns.map((column) => (
                <View
                  key={column.id}
                  style={{ width: columnWidth }}
                  className="border-l border-border"
                >
                  {rules.map((hour, index) => (
                    <View
                      key={hour}
                      style={{ top: index * hourHeight }}
                      className="absolute left-0 right-0 h-px bg-border/40"
                    />
                  ))}

                  {(laneMap.get(column.id) ?? []).map((laidOut) => {
                    const rect = eventRect(laidOut, day, hourHeight);
                    return (
                      <EventDrag
                        key={laidOut.event.id}
                        top={rect.top}
                        height={rect.height}
                        left={rect.leftFraction * columnWidth}
                        width={rect.widthFraction * columnWidth}
                        snapPx={(SNAP_MINUTES / MINUTES_PER_HOUR) * hourHeight}
                        onCommit={(deltaY) => handleDragCommit(laidOut.event.id, deltaY)}
                      >
                        <EventBlock
                          event={laidOut.event}
                          accent={column.accent}
                          rect={rect}
                          selected={laidOut.event.id === selectedEventId}
                          timeZone={day.timeZone}
                          onSelect={selectEvent}
                          onNudge={handleNudge}
                        />
                      </EventDrag>
                    );
                  })}
                </View>
              ))}

              {nowOffset === null ? null : (
                <View
                  pointerEvents="none"
                  style={{ top: nowOffset, left: TIME_GUTTER_WIDTH }}
                  className="absolute right-0 h-0.5 bg-accent"
                />
              )}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Holds the grid's measured width. `measure` ignores an unchanged value so a
 * layout pass that reports the same width cannot loop.
 */
function createWidthStore() {
  return createStore<{ width: number; measure: (width: number) => void }>((set, get) => ({
    width: 0,
    measure: (width) => {
      if (width !== get().width) set({ width });
    },
  }));
}

function ColumnHeader({ column, width }: { column: GridColumn; width: number }) {
  return (
    <View
      style={{ width }}
      className="flex-row items-center gap-2 border-l border-border px-3 py-2"
    >
      {column.resource ? (
        <Avatar size="sm" name={column.resource.name} imageUri={column.resource.avatarUrl} />
      ) : null}
      <Text numberOfLines={1} className="flex-1 text-sm font-medium text-text md:text-base">
        {column.label}
      </Text>
      <View className={`h-1.5 w-1.5 rounded-full ${ACCENT_CLASSES[column.accent].dot}`} />
    </View>
  );
}
