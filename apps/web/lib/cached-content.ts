import 'server-only';
import { cacheLife } from 'next/cache';
import {
  getPlace,
  getStory,
  getWalk,
  getPlaceByLegacySlug,
  listEventsForDate,
  listExploreCatalogue,
  listStories,
  listWalks,
} from '@acme/payload/server';
import type { UnavailableReason } from '@acme/app/content';

/**
 * Cached wrappers over the Payload readers ('use cache', cacheComponents).
 * A return visit or a Link prefetch reuses the read instead of hitting the
 * database again, so pages no longer opt out with `connection()`.
 *
 * - An answer (`ok` / `not-found`) lives for `minutes`: there are no
 *   revalidateTag hooks on the collections yet, so this bounds how long a CMS
 *   edit takes to show.
 * - A miss lives for `seconds`, which Next keeps out of prerenders, so a
 *   build without DATABASE_URL never bakes "couldn't check" into the shell.
 *
 * The `Error` on a failed read is logged here and dropped: cached values must
 * serialize.
 */
type Cached<R> = R extends { status: 'unavailable' } ? { status: 'unavailable'; reason: UnavailableReason } : R;

function settle<R extends { status: string }>(label: string, result: R): Cached<R> {
  if (result.status === 'unavailable') {
    const { reason, error } = result as { status: string; reason?: UnavailableReason; error?: Error };
    if (error) console.error(`${label} read failed`, error, error.cause);
    cacheLife('seconds');
    return { status: 'unavailable', reason: reason ?? 'query-failed' } as Cached<R>;
  }
  cacheLife('minutes');
  return result as Cached<R>;
}

export async function cachedWalks() {
  'use cache';
  return settle('walks', await listWalks());
}

export async function cachedStories() {
  'use cache';
  return settle('stories', await listStories());
}

export async function cachedEventsForDate(date: string) {
  'use cache';
  return settle(`events ${date}`, await listEventsForDate(date));
}

export async function cachedPlace(slug: string) {
  'use cache';
  return settle(`place ${slug}`, await getPlace(slug));
}

export async function cachedPlaceByLegacySlug(slug: string) {
  'use cache';
  return settle(`legacy place ${slug}`, await getPlaceByLegacySlug(slug));
}

export async function cachedExploreCatalogue() {
  'use cache';
  return settle('places', await listExploreCatalogue());
}

// generateMetadata and the page both call these; 'use cache' dedupes them
// within a request as React.cache did, and across requests too.
export async function cachedWalk(slug: string) {
  'use cache';
  return settle(`walk ${slug}`, await getWalk(slug));
}

export async function cachedStory(slug: string) {
  'use cache';
  return settle(`story ${slug}`, await getStory(slug));
}
