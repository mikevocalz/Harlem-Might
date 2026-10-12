'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MightsButton, MightsText } from '@acme/ui/mights';
import type { EventSearch } from '@acme/app/features/site/today/event-query.ts';
import { retryTodayEvents } from '../../lib/today-retry-action.ts';

/** Expire this range/page, then refresh the current URL (including query state). */
export function TodayRetry(search: EventSearch) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  return <>
    <MightsButton disabled={pending} onPress={() => startTransition(async () => {
      setFailed(false);
      try {
        await retryTodayEvents(search);
        router.refresh();
      } catch {
        setFailed(true);
      }
    })}>{pending ? 'Checking…' : 'Try again'}</MightsButton>
    {failed ? <MightsText size="small">The retry didn’t reach our records. Please try again.</MightsText> : null}
  </>;
}
