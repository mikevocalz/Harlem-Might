import { eventsOverlap, type ScheduleEvent } from './model.ts';

export const DEFAULT_SLOT_MINUTES = 30;

const MS_PER_MINUTE = 60_000;

export interface Slot {
  start: Date;
  end: Date;
  available: boolean;
}

/**
 * Bookable slots across the day's window for one resource.
 *
 * Walks forward from `dayStart` in fixed increments rather than deriving
 * boundaries from the events themselves, so the strip stays aligned to the
 * half hour even when the day is fully booked.
 */
export function slotsForResource(params: {
  dayStart: Date;
  startHour: number;
  endHour: number;
  events: readonly ScheduleEvent[];
  resourceId: string;
  slotMinutes?: number;
}): Slot[] {
  const { dayStart, startHour, endHour, events, resourceId } = params;
  const slotMinutes = params.slotMinutes ?? DEFAULT_SLOT_MINUTES;

  const busy = events.filter((event) => event.resourceId === resourceId);
  const totalMinutes = (endHour - startHour) * 60;
  const count = Math.floor(totalMinutes / slotMinutes);

  const slots: Slot[] = [];
  for (let index = 0; index < count; index += 1) {
    const start = new Date(dayStart.getTime() + index * slotMinutes * MS_PER_MINUTE);
    const end = new Date(start.getTime() + slotMinutes * MS_PER_MINUTE);
    const probe: ScheduleEvent = {
      id: `slot-${index}`,
      resourceId,
      title: '',
      start,
      end,
      kind: 'block',
    };
    slots.push({
      start,
      end,
      available: !busy.some((event) => eventsOverlap(event, probe)),
    });
  }
  return slots;
}
