'use client';
import { ScheduleScreen, useScheduleStore } from '@acme/app';

// Detail pane of the split view — the only router-driven column.
// The booking sheet is mounted at the ROOT (app/_layout.tsx), not here.
export default function SplitDetail() {
  const openBooking = useScheduleStore((state) => state.openBooking);
  return <ScheduleScreen onNewBooking={openBooking} fill />;
}
