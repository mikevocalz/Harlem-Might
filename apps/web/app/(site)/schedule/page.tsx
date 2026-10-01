'use client';

import { ScheduleScreen } from '@acme/app';

// Thin route wrapper — the screen lives in packages/app/features (Solito pattern).
export default function SchedulePage() {
  return <ScheduleScreen />;
}
