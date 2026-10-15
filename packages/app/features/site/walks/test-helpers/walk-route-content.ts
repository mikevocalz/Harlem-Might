import type { WalkRecord } from '../../../../content/records.ts';
import type { ScreenResult } from '../../stories/StoriesScreen.tsx';

/** Read-only in-memory boundary for the Next walk route composition tests. */
export const routeContent: {
  walk: ScreenResult<WalkRecord> | { status: 'not-found' };
  walks: ScreenResult<readonly WalkRecord[]>;
  slug?: string;
} = { walk: { status: 'not-found' }, walks: { status: 'ok', data: [] } };

export async function cachedWalk(slug: string) {
  routeContent.slug = slug;
  return routeContent.walk;
}

export async function cachedWalks() {
  return routeContent.walks;
}
