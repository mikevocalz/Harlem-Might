'use client';
import { create } from 'zustand';
import type { EventOverride } from './reschedule.ts';

export type ScheduleView = 'day' | 'week';

/** Height of one hour row in px. Zoom steps rather than a continuous scale. */
export const HOUR_HEIGHT_STEPS = [48, 64, 88, 120] as const;
export const DEFAULT_HOUR_HEIGHT = 64;

interface ScheduleState {
  view: ScheduleView;
  /** Resource ids to show; empty means all. */
  resourceFilter: string[];
  selectedEventId: string | null;
  hourHeight: number;
  /** Date the compact booking surface is showing, as an epoch day boundary. */
  selectedDate: string | null;
  /** Pending moves, keyed by event id and layered over the day at read time. */
  overrides: Record<string, EventOverride>;
  /** Month on screen in the mini calendar; null follows the selected date. */
  visibleMonth: string | null;
  /** Whether the new-booking sheet is presented. */
  bookingOpen: boolean;

  setView: (view: ScheduleView) => void;
  setResourceFilter: (resourceIds: string[]) => void;
  selectEvent: (eventId: string | null) => void;
  setHourHeight: (hourHeight: number) => void;
  selectDate: (isoDate: string) => void;
  moveEvent: (eventId: string, override: EventOverride) => void;
  clearMoves: () => void;
  showMonth: (month: string) => void;
  openBooking: () => void;
  closeBooking: () => void;
}

export const useScheduleStore = create<ScheduleState>((set) => ({
  view: 'day',
  resourceFilter: [],
  selectedEventId: null,
  hourHeight: DEFAULT_HOUR_HEIGHT,
  selectedDate: null,
  overrides: {},
  visibleMonth: null,
  bookingOpen: false,

  setView: (view) => set({ view }),
  setResourceFilter: (resourceFilter) => set({ resourceFilter }),
  selectEvent: (selectedEventId) => set({ selectedEventId }),
  setHourHeight: (hourHeight) => set({ hourHeight }),
  selectDate: (selectedDate) => set({ selectedDate }),
  moveEvent: (eventId, override) =>
    set((state) => ({ overrides: { ...state.overrides, [eventId]: override } })),
  clearMoves: () => set({ overrides: {} }),
  showMonth: (visibleMonth) => set({ visibleMonth }),
  openBooking: () => set({ bookingOpen: true }),
  closeBooking: () => set({ bookingOpen: false }),
}));
