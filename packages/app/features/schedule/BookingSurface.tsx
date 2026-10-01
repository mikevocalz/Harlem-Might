'use client';
import { View, Text, Pressable, ScrollView } from '@acme/ui/tw';
import { Button } from '@acme/ui';
import { formatTimeRange } from './format.ts';
import type { Resource, ScheduleDay } from './model.ts';
import { slotsForResource, type Slot } from './slots.ts';
import { useScheduleStore } from './store.ts';

const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
const MS_PER_DAY = 86_400_000;

export interface BookingSurfaceProps {
  day: ScheduleDay;
  /** The single resource being booked at compact width. */
  resource: Resource;
  onBook: (slot: Slot) => void;
}

/**
 * Compact-width booking surface.
 *
 * A resource day grid is the wrong UI below 600dp — several columns of
 * proportional-height blocks squeezed into a phone gives every appointment a
 * few characters of width and turns the whole grid into a horizontal-scroll
 * puzzle. This replaces it with the task the user actually has on a phone:
 * pick a day, pick a time. Rationale in README.md.
 */
export function BookingSurface({ day, resource, onBook }: BookingSurfaceProps) {
  const selectedDate = useScheduleStore((state) => state.selectedDate);
  const selectDate = useScheduleStore((state) => state.selectDate);
  const selectedEventId = useScheduleStore((state) => state.selectedEventId);
  const selectEvent = useScheduleStore((state) => state.selectEvent);

  const weekStart = new Date(day.dayStart.getTime() - day.dayStart.getDay() * MS_PER_DAY);
  const activeDate = selectedDate ?? day.dayStart.toISOString();

  const slots = slotsForResource({
    dayStart: day.dayStart,
    startHour: day.startHour,
    endHour: day.endHour,
    events: day.events,
    resourceId: resource.id,
  });

  const selectedSlot = slots.find((slot) => slot.start.toISOString() === selectedEventId);

  return (
    <View className="flex-1 gap-4 rounded-sheet border border-border bg-surface-raised p-4">
      <View className="flex-row justify-between">
        {DAY_INITIALS.map((initial, index) => {
          const date = new Date(weekStart.getTime() + index * MS_PER_DAY);
          const iso = date.toISOString();
          const isSelected = iso === activeDate;
          const isPast = date.getTime() < day.dayStart.getTime();

          return (
            <Pressable
              key={iso}
              onPress={() => selectDate(iso)}
              accessibilityState={{ selected: isSelected }}
              className="items-center gap-1"
            >
              <Text className="text-xs font-medium text-text-muted">{initial}</Text>
              <View
                className={`h-9 w-9 items-center justify-center rounded-full ${
                  isSelected ? 'bg-primary' : ''
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    isSelected
                      ? 'text-on-primary'
                      : isPast
                        ? 'text-text-muted/50'
                        : 'text-text'
                  }`}
                >
                  {date.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-2">
        {slots.map((slot) => {
          const iso = slot.start.toISOString();
          const isSelected = iso === selectedEventId;

          return (
            <Pressable
              key={iso}
              disabled={!slot.available}
              onPress={() => selectEvent(iso)}
              accessibilityState={{ selected: isSelected, disabled: !slot.available }}
              className={`rounded-md border-2 px-4 py-3 ${
                isSelected
                  ? 'border-primary bg-primary/10'
                  : slot.available
                    ? 'border-border bg-surface'
                    : 'border-border/40 bg-surface-sunken'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  slot.available ? 'text-text' : 'text-text-muted/60'
                }`}
              >
                {formatTimeRange(
                  { ...slot, id: iso, resourceId: resource.id, title: '', kind: 'block' },
                  day.timeZone,
                )}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* The kit's Button has no `disabled`, so the unavailable state is the
          absence of a press handler plus a dimmed surface, not a fake prop. */}
      <Button
        variant="primary"
        title="Book appointment"
        onPress={selectedSlot ? () => onBook(selectedSlot) : undefined}
        className={`w-full ${selectedSlot ? '' : 'opacity-50'}`}
      />
    </View>
  );
}
