'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MightsButton } from '@acme/ui/mights';

/** Refresh the current view/page rather than navigating to an already-open URL. */
export function TodayRetry() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <MightsButton disabled={pending} onPress={() => startTransition(() => router.refresh())}>{pending ? 'Checking…' : 'Try again'}</MightsButton>;
}
