export { Schedule, type ScheduleProps } from './Schedule';
export { ScheduleGrid, type ScheduleGridProps } from './ScheduleGrid';
export { BookingSurface, type BookingSurfaceProps } from './BookingSurface';
export { EventBlock, type EventBlockProps } from './EventBlock';

export {
  RESOURCE_ACCENTS,
  accentForEvent,
  eventsOverlap,
  zonedMinutesOfDay,
  type Resource,
  type ResourceAccent,
  type ScheduleDay,
  type ScheduleEvent,
  type ScheduleEventKind,
} from './model';
export { assignLanes, lanesByResource, type LaidOutEvent } from './lanes';
export {
  currentTimeOffset,
  eventRect,
  gridHeight,
  hourRules,
  offsetForMinutes,
  MIN_EVENT_HEIGHT,
  RESOURCE_COLUMN_WIDTH,
  TIME_GUTTER_WIDTH,
  type EventRect,
} from './geometry';
export { slotsForResource, DEFAULT_SLOT_MINUTES, type Slot } from './slots';
export { formatHourLabel, formatTimeRange } from './format';
export {
  useScheduleStore,
  DEFAULT_HOUR_HEIGHT,
  HOUR_HEIGHT_STEPS,
  type ScheduleView,
} from './store';
export { DEMO_DAY, DEMO_NOW, DEMO_RESOURCES, DEMO_EVENTS } from './fixtures';
export { MiniCalendar, type MiniCalendarProps } from './MiniCalendar';
export { monthMatrix, addMonths, isSameDay, formatMonthTitle, WEEKDAY_INITIALS } from './month';
export { BookingForm, type BookingFormProps } from './BookingForm';
export { NotesEditor, type NotesEditorProps } from './NotesEditor';
