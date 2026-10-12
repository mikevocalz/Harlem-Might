import type { ContentReaders, ContentRequestOptions } from '../../content/readers.ts';
import { contentQuery } from '../../content/result.ts';

export async function fetchMusicArtistsPage(
  fetchPage: (page: number, options?: ContentRequestOptions) => ReturnType<ContentReaders['listMusicArtistsPage']>,
  page: number,
  options?: ContentRequestOptions,
) {
  const result = await contentQuery(fetchPage(page, options));
  return { ...result.data, page };
}

interface MusicPaginationState {
  hasNextPage: boolean;
  isFetching: boolean;
  isFetchNextPageError: boolean;
  fetchNextPage: (options: { cancelRefetch: false }) => Promise<unknown>;
}

/** Scroll never retries errors or interrupts a reconnect refresh; a press may retry. */
export function requestNextMusicPage(query: MusicPaginationState, automatic = false): void {
  if (!query.hasNextPage || query.isFetching || (automatic && query.isFetchNextPageError)) return;
  // Repeated events can share a render's flags. Do not cancel the first request.
  void query.fetchNextPage({ cancelRefetch: false });
}
