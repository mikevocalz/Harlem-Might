'use client';
import { View, Text, Pressable } from '@acme/ui/tw';
import { Section } from '@acme/ui/primitives';
import { Avatar, Button, Container, notify, useAppForm, useFormStore } from '@acme/ui';
import { DEMO_DAY, DEMO_RESOURCES } from './fixtures.ts';
import { slotsForResource } from './slots.ts';
import { formatTime } from './format.ts';
import { useScheduleStore } from './store.ts';
import { NotesEditor } from './NotesEditor.tsx';
import { pickNoteImage } from './pick-note-image';

export interface BookingFormProps {
  /** Opens editor settings. Supplied by the route, which owns navigation. */
  onOpenEditorSettings?: () => void;
  /** Called after a successful submit so the host can dismiss the sheet. */
  onDone: () => void;
}

/**
 * New-booking form.
 *
 * TanStack Form via the kit's `useAppForm` — form state lives in TanStack's own
 * store, never React state, per the repo rule.
 *
 * Instructor and time are CHIPS, not selects. Two reasons, and the first is
 * functional: the kit's Select renders a non-interactive View+Text on native
 * (primitives/dom.native.tsx), so a select here could not be operated at all —
 * it showed the raw resource id and an empty time. Chips are also the app's
 * established active-state grammar (black-on-yellow), so the choices are
 * visible rather than remembered, which is the whole point of a booking form.
 */
const SLOT_GROUPS = ['Morning', 'Afternoon'] as const;

/** Which half of the day a slot falls in, in the calendar's zone. */
function partOfDay(instant: Date, timeZone: string): (typeof SLOT_GROUPS)[number] {
  const hour = Number.parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(
      instant,
    ),
    10,
  );
  return hour < 12 ? 'Morning' : 'Afternoon';
}

export function BookingForm({ onDone, onOpenEditorSettings }: BookingFormProps) {
  const moveEvent = useScheduleStore((state) => state.moveEvent);
  const selectEvent = useScheduleStore((state) => state.selectEvent);

  const form = useAppForm({
    defaultValues: {
      title: '',
      resourceId: DEMO_RESOURCES[0]?.id ?? '',
      slot: '',
      notes: '',
    },
    onSubmit: async ({ value }) => {
      // Booking creation is not backed by a collection yet, so the new slot is
      // recorded as an override and selected — the same path the grid and the
      // slot list already read. Swap for a mutation when Payload lands.
      if (value.slot) {
        const start = new Date(value.slot);
        moveEvent(`booking-${start.toISOString()}`, {
          start,
          end: new Date(start.getTime() + 30 * 60_000),
          resourceId: value.resourceId,
        });
        selectEvent(value.slot);
        // The sheet closes on submit, so without this the booking is created
        // with no acknowledgement at all — the user is returned to the grid and
        // has to hunt for the slot to know it worked.
        notify.success('Booking created', {
          description: `${value.title || 'Untitled'} · ${formatTime(start, DEMO_DAY.timeZone)}`,
        });
      }
      onDone();
    },
  });

  // Subscribed, not snapshotted. Reading `form.state.values` directly does not
  // re-render on change, so tapping a chip set the value but the selection
  // never appeared — the chips looked unselectable.
  const resourceId = useFormStore(form.store, (state) => state.values.resourceId);
  const selectedSlot = useFormStore(form.store, (state) => state.values.slot);

  const slots = slotsForResource({
    dayStart: DEMO_DAY.dayStart,
    startHour: DEMO_DAY.startHour,
    endHour: DEMO_DAY.endHour,
    events: DEMO_DAY.events,
    resourceId,
  }).filter((slot) => slot.available);

  return (
    // Sheet shell caps at max-w-3xl (content-detail = 48rem) and centres.
    <Container width="detail" className="flex-1 px-6 pb-10 pt-3">
      {/* One cap only. A second, narrower container used to sit here and
          squeezed the content to 38rem, which forced the notes toolbar to wrap
          mid-row. Sections are spaced far enough apart to read as groups. */}
      <View className="gap-7">
      <Section className="gap-1">
        <Text className="font-display text-xl text-text">New booking</Text>
        <Text className="text-sm text-text-muted">
          Pick who is teaching and when. You can add notes after.
        </Text>
      </Section>

      <form.AppField
        name="title"
        validators={{
          onChange: ({ value }) => (value.trim() ? undefined : 'Give the booking a name'),
        }}
      >
        {(field) => <field.TextField label="What is it?" placeholder="Theory lesson" />}
      </form.AppField>

      <Section className="gap-2">
        <Text className="text-sm font-medium text-text">Instructor</Text>
        <View className="flex-row flex-wrap gap-2">
          {DEMO_RESOURCES.map((resource) => {
            const active = resource.id === resourceId;
            return (
              <Pressable
                key={resource.id}
                onPress={() => {
                  form.setFieldValue('resourceId', resource.id);
                  // Their free slots differ, so a stale time would be wrong.
                  form.setFieldValue('slot', '');
                }}
                accessibilityState={{ selected: active }}
                className={`flex-row items-center gap-2 rounded-md border-2 border-border px-2.5 py-1.5 ${
                  active ? 'bg-primary' : 'bg-surface'
                }`}
              >
                <Avatar size="sm" name={resource.name} />
                <Text
                  className={`text-sm font-medium ${active ? 'text-on-primary' : 'text-text'}`}
                >
                  {resource.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section className="gap-3">
        <View className="flex-row items-baseline justify-between">
          <Text className="text-sm font-medium text-text">Available times</Text>
          {/* Duration stated ONCE here instead of repeated in every chip — the
              chips then only carry the start time, which is the part that
              actually differs and the part being scanned. */}
          <Text className="text-xs text-text-muted">30 min each</Text>
        </View>

        {slots.length === 0 ? (
          <Text className="text-sm text-text-muted">
            Fully booked today. Try another instructor.
          </Text>
        ) : (
          SLOT_GROUPS.map((group) => {
            const inGroup = slots.filter(
              (slot) => partOfDay(slot.start, DEMO_DAY.timeZone) === group,
            );
            if (inGroup.length === 0) return null;

            return (
              <View key={group} className="gap-2">
                {/* Chunked into morning/afternoon so the eye scans a short
                    list twice instead of one undifferentiated block of ten. */}
                <Text className="text-xs font-semibold uppercase text-text-muted">
                  {group}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {inGroup.map((slot) => {
                    const iso = slot.start.toISOString();
                    const active = iso === selectedSlot;
                    return (
                      <Pressable
                        key={iso}
                        onPress={() => form.setFieldValue('slot', iso)}
                        accessibilityLabel={formatTime(slot.start, DEMO_DAY.timeZone)}
                        accessibilityState={{ selected: active }}
                        // w-28 keeps every chip the same width so they form a
                        // grid rather than a ragged wrap; py-3 clears the 44dp
                        // minimum touch target the previous py-1.5 missed.
                        className={`w-28 items-center rounded-md border-2 border-border py-3 ${
                          active ? 'bg-primary' : 'bg-surface'
                        }`}
                      >
                        <Text
                          className={`text-base font-semibold ${
                            active ? 'text-on-primary' : 'text-text'
                          }`}
                        >
                          {formatTime(slot.start, DEMO_DAY.timeZone)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
      </Section>

      <form.AppField name="notes">
        {(field) => (
          <NotesEditor
            label="Notes"
            placeholder="Anything to prepare?"
            onChangeHtml={field.handleChange}
            onPickImage={pickNoteImage}
            onOpenSettings={onOpenEditorSettings}
          />
        )}
      </form.AppField>

      {/* Cancel sits beside Create so there is an explicit exit, not just a
          swipe-down. Secondary weight, so it never competes with the action. */}
      <View className="flex-row gap-3 border-t-2 border-border/20 pt-5">
        <Button variant="outline" title="Cancel" onPress={onDone} className="flex-1" />
        <form.AppForm>
          <form.SubmitButton title="Create booking" className="flex-[2]" />
        </form.AppForm>
      </View>
      </View>
    </Container>
  );
}
