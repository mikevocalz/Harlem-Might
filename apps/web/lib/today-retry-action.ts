'use server';

import { updateTag } from 'next/cache';
import { cachedEventsForDateRange } from './cached-content.ts';
import { eventRetryTarget } from './event-cache-key.ts';

/** Retry failed reads only; a successful cached listing is never invalidated. */
export async function retryTodayEvents(input: unknown) {
  const { start, end, page, tag } = eventRetryTarget(input);
  const result = await cachedEventsForDateRange(start, end, page);
  if (result.status === 'unavailable') updateTag(tag);
}
