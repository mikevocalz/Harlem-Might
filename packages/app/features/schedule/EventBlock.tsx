'use client';
import { memo } from 'react';
import { View, Text, Pressable } from '@acme/ui/tw';
import { ACCENT_CLASSES } from './accent-classes.ts';
import { formatTimeRange } from './format.ts';
import type { EventRect } from './geometry.ts';
import type { ResourceAccent, ScheduleEvent } from './model.ts';
import { SNAP_MINUTES } from './reschedule.ts';

export interface EventBlockProps {
  event: ScheduleEvent;
  accent: ResourceAccent;
  rect: EventRect;
  selected: boolean;
  timeZone: string;
  onSelect: (eventId: string) => void;
  /** Move by whole snap increments. Negative is earlier. */
  onNudge: (eventId: string, deltaMinutes: number) => void;
}

/**
 * One appointment.
 *
 * The `style` prop carries POSITION AND SIZE ONLY — the documented computed
 * geometry exception. Everything visual (tint, accent hue, radius, border,
 * type) is a Tailwind class from tokens, which is also what makes the selected
 * state a real state rather than a one-off override.
 */
function EventBlockImpl({
  event,
  accent,
  rect,
  selected,
  timeZone,
  onSelect,
  onNudge,
}: EventBlockProps) {
  const classes = ACCENT_CLASSES[accent];

  return (
    <Pressable
      onPress={() => onSelect(event.id)}
      accessibilityLabel={`${event.title}, ${formatTimeRange(event, timeZone)}`}
      accessibilityState={{ selected }}
      onKeyDown={(nativeEvent) => {
        const key = (nativeEvent as { key?: string }).key;
        if (key !== 'ArrowUp' && key !== 'ArrowDown') return;
        (nativeEvent as { preventDefault?: () => void }).preventDefault?.();
        onNudge(event.id, key === 'ArrowDown' ? SNAP_MINUTES : -SNAP_MINUTES);
      }}
      // Fills the EventDrag wrapper, which owns the absolute geometry so the
      // native fork has something to animate.
      className={`absolute inset-0 overflow-hidden rounded-md ${
        selected ? classes.selectedSurface : classes.surface
      }`}
    >
      {/* Thick saturated leading edge. On the solid selected block it would be
          invisible against its own accent, so it is only drawn on the tint. */}
      {selected ? null : <View className={`absolute bottom-0 left-0 top-0 w-1 ${classes.bar}`} />}

      <View className="flex-1 justify-center gap-0.5 py-1 pl-3 pr-2">
        <Text
          numberOfLines={1}
          className={`text-sm font-semibold ${selected ? classes.selectedTitle : classes.title}`}
        >
          {event.title}
        </Text>
        {rect.height > 40 ? (
          <Text
            numberOfLines={1}
            className={`text-xs font-normal ${
              selected ? classes.selectedTitle : 'text-text-muted'
            }`}
          >
            {formatTimeRange(event, timeZone)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Memoised on the props that actually change per frame.
 *
 * A drag rewrites one event's override, which re-renders the grid; without this
 * every other block in every column re-renders too. The comparator is explicit
 * rather than shallow because `rect` is rebuilt each render by `eventRect` and
 * would always fail reference equality.
 */
export const EventBlock = memo(EventBlockImpl, (prev, next) => {
  return (
    prev.event === next.event &&
    prev.accent === next.accent &&
    prev.selected === next.selected &&
    prev.timeZone === next.timeZone &&
    prev.onSelect === next.onSelect &&
    prev.onNudge === next.onNudge &&
    prev.rect.top === next.rect.top &&
    prev.rect.height === next.rect.height &&
    prev.rect.leftFraction === next.rect.leftFraction &&
    prev.rect.widthFraction === next.rect.widthFraction
  );
});
EventBlock.displayName = 'EventBlock';
