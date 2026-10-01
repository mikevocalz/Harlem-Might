'use client';
import { View, Text, Pressable } from '@acme/ui/tw';
import { Button, Container, EmptyState, LoadingSkeleton, SegmentedControl, useSizeClass } from '@acme/ui';
import { Calendar } from '@acme/ui/icons';
import { BookingSurface } from './BookingSurface.tsx';
import { ScheduleGrid } from './ScheduleGrid.tsx';
import type { ScheduleDay } from './model.ts';
import type { Slot } from './slots.ts';
import { useScheduleStore, type ScheduleView } from './store.ts';

export interface ScheduleProps {
  /** Fill the parent instead of applying the screen max-width. */
  fill?: boolean;
  day: ScheduleDay;
  /** Injected rather than read from the clock, so renders stay deterministic. */
  now: Date;
  loading?: boolean;
  onBook: (slot: Slot) => void;
  /** Header action — create a booking outside the slot list. */
  onNewBooking: () => void;
}

const VIEWS: { value: ScheduleView; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
];

/**
 * Today's Schedule.
 *
 * Knows nothing about the split view it is rendered in — it reads the WINDOW
 * size class, exactly as it would if it were the only thing on screen. That is
 * what lets the detail pane host it without either side importing the other.
 */
export function Schedule({
  fill, day, now, loading = false, onBook, onNewBooking }: ScheduleProps) {
  const sizeClass = useSizeClass();
  const view = useScheduleStore((state) => state.view);
  const setView = useScheduleStore((state) => state.setView);

  const [firstResource] = day.resources;

  return (
    // Recessed canvas: the grid card is surface-raised, so a deeper ground is
    // what makes it read as a floating sheet rather than a bordered box.
    <Container
      // Inside a split pane the PANE is the measure constraint, so a second cap
      // on top of it just leaves dead space to the right — collapsing the
      // sidebar would visibly do nothing. Standalone, the screen keeps the
      // normal readable cap.
      width={fill ? 'full' : undefined}
      // The `full` variant is `max-w-none px-0` — it drops the container's own
      // horizontal padding along with the cap, so the pane has to put it back
      // or the grid sits flush against the pane edge.
      className={`flex-1 gap-4 bg-surface-sunken py-4 ${fill ? 'px-4 sm:px-6' : ''}`}
    >
      <View className="flex-row items-center gap-3">
        <Text className="flex-1 text-xl font-semibold text-text md:text-2xl lg:text-3xl">Today&apos;s Schedule</Text>

        {/* The platform's own segmented control (@expo/ui), not a hand-rolled
            row of pressables — same reasoning as every other native control in
            the kit. */}
        <SegmentedControl options={VIEWS} value={view} onChange={setView} />

        <Button variant="primary" title="New booking" onPress={onNewBooking} />
      </View>

      {loading ? (
        <LoadingSkeleton count={6} className="h-12 w-full" />
      ) : day.resources.length === 0 ? (
        <EmptyState
          icon={<Calendar className="text-text-muted" />}
          title="No one is scheduled today"
          description="Add an instructor to this day to start booking lessons."
        />
      ) : sizeClass === 'compact' && firstResource ? (
        <BookingSurface day={day} resource={firstResource} onBook={onBook} />
      ) : (
        <ScheduleGrid day={day} now={now} />
      )}
    </Container>
  );
}
