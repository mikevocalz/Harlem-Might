'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { harlemToday } from '@acme/app/content';

/** Keep an open calendar current when New York's day changes or a tab resumes. */
export function TodayDateRefresh({ date }: { date: string }) {
  const router = useRouter();
  useEffect(() => {
    const refreshDate = () => { if (harlemToday() !== date) router.refresh(); };
    const timer = window.setInterval(refreshDate, 30_000);
    document.addEventListener('visibilitychange', refreshDate);
    refreshDate();
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refreshDate); };
  }, [date, router]);
  return null;
}
