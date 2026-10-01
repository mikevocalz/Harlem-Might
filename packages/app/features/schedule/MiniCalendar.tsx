'use client';
import { View, Text, Pressable } from '@acme/ui/tw';
import { IconButton } from '@acme/ui';
import { ChevronLeft, ChevronRight } from '@acme/ui/icons';
import {
  WEEKDAY_INITIALS,
  addMonths,
  formatMonthTitle,
  isSameDay,
  monthMatrix,
} from './month.ts';

export interface MiniCalendarProps {
  /** Month currently on screen. */
  month: Date;
  /** Day the schedule is showing. */
  selected: Date;
  /** Today, injected so renders stay deterministic. */
  today: Date;
  onSelect: (date: Date) => void;
  onMonthChange: (month: Date) => void;
}

/**
 * Month grid for the supplementary column.
 *
 * Follows the kit's RetroUI grammar rather than a generic calendar look: ink
 * borders, a hard offset shadow, square-ish `rounded-md` cells, and the
 * selected day as a BLACK-ON-YELLOW chip. Yellow text is never used as the
 * indicator — it is illegible on light paper, and the chip is the same active
 * state the rest of the app uses, so the calendar reads as part of the system
 * instead of a bolted-on widget.
 *
 * NOT built from the kit's table primitives, deliberately. A month grid is
 * tabular data, but on native `@expo/html-elements` models TD/TH as TableText
 * — a Text element — so a cell cannot contain a Pressable without nesting a
 * View inside a Text, which React Native rejects at runtime. The grid roles and
 * per-cell accessibility labels below carry the same semantics that survive on
 * both platforms.
 */
export function MiniCalendar({
  month,
  selected,
  today,
  onSelect,
  onMonthChange,
}: MiniCalendarProps) {
  const weeks = monthMatrix(month);

  return (
    <View className="gap-2 rounded-md border-2 border-border bg-surface-raised p-3 shadow-card">
      <View className="flex-row items-center justify-between">
        <IconButton
          variant="ghost"
          size="sm"
          aria-label="Previous month"
          // A real left chevron, never a rotated right one: a Tailwind rotate
          // resolves to a transform that react-native-svg cannot parse, which
          // crashes the icon with "Cannot convert null value to object".
          icon={<ChevronLeft className="text-text-muted" />}
          onPress={() => onMonthChange(addMonths(month, -1))}
        />
        <Text className="font-display text-sm text-text">{formatMonthTitle(month)}</Text>
        <IconButton
          variant="ghost"
          size="sm"
          aria-label="Next month"
          icon={<ChevronRight className="text-text-muted" />}
          onPress={() => onMonthChange(addMonths(month, 1))}
        />
      </View>

      <View role="grid" className="w-full">
        <View role="row" className="flex-row">
          {WEEKDAY_INITIALS.map((initial) => (
            <View key={initial} role="columnheader" className="flex-1 items-center py-1">
              <Text className="text-xs font-semibold uppercase text-text-muted">{initial}</Text>
            </View>
          ))}
        </View>

        {weeks.map((week) => (
          <View key={week[0]?.date.toISOString()} role="row" className="flex-row">
            {week.map(({ date, inMonth }) => {
            const isSelected = isSameDay(date, selected);
            const isToday = isSameDay(date, today);

            return (
              <View key={date.toISOString()} role="cell" className="flex-1 py-0.5">
              <Pressable
                onPress={() => onSelect(date)}
                accessibilityLabel={date.toDateString()}
                accessibilityState={{ selected: isSelected }}
                className="items-center"
              >
                <View
                  className={`h-7 w-7 items-center justify-center rounded-md ${
                    isSelected
                      ? 'bg-primary'
                      : isToday
                        ? 'border-2 border-border'
                        : ''
                  }`}
                >
                  <Text
                    className={`text-xs ${
                      isSelected
                        ? 'font-semibold text-on-primary'
                        : inMonth
                          ? 'text-text'
                          : 'text-text-muted/50'
                    }`}
                  >
                    {date.getDate()}
                  </Text>
                </View>
              </Pressable>
              </View>
            );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
