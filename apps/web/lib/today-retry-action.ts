'use server';

import { updateTag } from 'next/cache';
import { eventRetryCacheTag } from './event-cache-key.ts';

/** Immediately expire only the requested public calendar page before refresh. */
export async function retryTodayEvents(input: unknown) {
  updateTag(eventRetryCacheTag(input));
}
