'use client';

import { useCallback, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ExploreLoader } from '@acme/spatial/explore-loader';
import {
  type ContentResult,
  type MusicArtistPage,
  type UnavailableReason,
} from '@acme/app/content';
import { useReducedMotion } from '@acme/ui';
import {
  MightsButton,
  MightsPage,
  MightsText,
  routes,
} from '@acme/ui/mights';
import { Pressable, View } from '@acme/ui/tw';
import { ContentLoader } from '../site/content/ContentLoader.tsx';
import { ContentNotice } from '../site/content/ContentNotice.tsx';
import { musicKeys } from './music.keys.ts';
import { MusicArtistGrid } from './MusicArtistGrid.tsx';
import { requestNextMusicPage } from './music-pagination.ts';

/** Reads one 1-based page of the directory — Local API on the web server, REST everywhere else. */
export type MusicPageFetch = (page: number) => Promise<ContentResult<MusicArtistPage>>;

/**
 * Page 1 as the host read it. Serialized across the RSC boundary on web, so a
 * failed read arrives without its `error` — anything but `ok` simply refetches.
 */
export type MusicFirstPage =
  | { status: 'ok'; data: MusicArtistPage }
  | { status: 'unavailable'; reason?: UnavailableReason };

interface PagedArtists extends MusicArtistPage {
  page: number;
}

/**
 * The tail of the directory — the Rive loader IS the control. It spins at the
 * foot of the grid, its outer ring filling with `shown / total` as pages
 * accumulate; tapping it pulls the next page.
 */
function LoadMore({
  shown,
  total,
  hasNextPage,
  isFetching,
  failed,
  onMore,
}: {
  shown: number;
  total: number;
  hasNextPage: boolean;
  isFetching: boolean;
  failed: boolean;
  onMore: () => void;
}) {
  const reducedMotion = useReducedMotion();
  if (!hasNextPage) {
    return total > 0 ? (
      <View className="mt-10 items-center">
        <MightsText size="small" className="text-text-muted">
          {total} artists — the whole directory
        </MightsText>
      </View>
    ) : null;
  }
  return (
    <View className="mt-10 flex flex-col items-center gap-4">
      <Pressable
        onPress={onMore}
        disabled={isFetching}
        role="button"
        aria-label={`Load more artists — ${shown} of ${total} shown`}
        className="flex flex-col items-center gap-2"
      >
        <ExploreLoader
          size={72}
          phase={reducedMotion ? 'reduced' : 'loading'}
          progress={total > 0 ? shown / total : undefined}
          label="Loading more artists"
        />
        <MightsText size="small" className="font-semibold uppercase tracking-[0.14em] text-primary">
          {failed ? 'Try again' : 'More artists'}
        </MightsText>
      </Pressable>
      <MightsText size="small" className="text-text-muted">
        {shown} of {total} artists
      </MightsText>
    </View>
  );
}

function MusicIndexBody({
  query,
  onMore,
}: {
  query: ReturnType<typeof useMusicArtists>;
  onMore: () => void;
}) {
  const pages = query.data?.pages;
  const artists = pages?.flatMap((page) => page.artists) ?? [];
  const total = pages?.at(-1)?.totalDocs ?? artists.length;

  if (query.isPending) return <ContentLoader label="Checking for published artists" />;
  if (artists.length === 0 && query.isError) {
    return (
      <ContentNotice
        title="We couldn’t check the music directory right now"
        actions={
          <>
            <MightsButton onPress={() => void query.refetch()}>Try again</MightsButton>
            <MightsButton href={routes.explore()} variant="secondary">
              Open the map
            </MightsButton>
          </>
        }
      >
        Our records didn’t answer, so we can’t say which artist profiles are
        published. Try again in a moment.
      </ContentNotice>
    );
  }
  if (artists.length === 0) {
    return (
      <ContentNotice
        title="No artist profiles are published yet"
        actions={
          <MightsButton href={routes.explore()} variant="secondary">
            Open the map
          </MightsButton>
        }
      >
        Artist biographies join the directory as editorial verification and
        image licensing are completed. The map and walks are ready now.
      </ContentNotice>
    );
  }
  return (
    <>
      <MusicArtistGrid artists={artists} />
      <LoadMore
        shown={artists.length}
        total={total}
        hasNextPage={query.hasNextPage}
        isFetching={query.isFetching}
        failed={query.isFetchNextPageError}
        onMore={onMore}
      />
    </>
  );
}

function useMusicArtists(firstPage: MusicFirstPage | undefined, fetchPage: MusicPageFetch) {
  return useInfiniteQuery({
    queryKey: musicKeys.artists,
    initialPageParam: 1,
    // Page 1 arrives server-rendered on web; treat it as fresh so the client
    // doesn't immediately re-request the page it just rendered.
    initialData:
      firstPage?.status === 'ok'
        ? { pages: [{ ...firstPage.data, page: 1 } satisfies PagedArtists], pageParams: [1] }
        : undefined,
    initialDataUpdatedAt: () => Date.now(),
    staleTime: 60_000,
    queryFn: async ({ pageParam }): Promise<PagedArtists> => {
      const result = await fetchPage(pageParam);
      if (result.status !== 'ok') {
        throw new Error(`music-artists page ${pageParam} unavailable: ${result.reason ?? 'unknown'}`);
      }
      return { ...result.data, page: pageParam };
    },
    getNextPageParam: (last) => (last.hasNextPage ? last.page + 1 : undefined),
  });
}

/**
 * The Music index, shared by the site page and the app tab. `firstPage` is the
 * host's first page (SSR on web, none on mobile); `fetchPage` reads further pages.
 */
export function MusicIndexScreen({
  firstPage,
  fetchPage,
}: {
  firstPage: MusicFirstPage | undefined;
  fetchPage: MusicPageFetch;
}) {
  const query = useMusicArtists(firstPage, fetchPage);
  const { hasNextPage, isFetching, isFetchNextPageError, fetchNextPage } = query;
  const loadMore = useCallback(() => {
    requestNextMusicPage({ hasNextPage, isFetching, isFetchNextPageError, fetchNextPage });
  }, [hasNextPage, isFetching, isFetchNextPageError, fetchNextPage]);
  const loadMoreAutomatically = useCallback(() => {
    requestNextMusicPage({ hasNextPage, isFetching, isFetchNextPageError, fetchNextPage }, true);
  }, [hasNextPage, isFetching, isFetchNextPageError, fetchNextPage]);

  // Web: stream the next page once the directory's foot nears the viewport —
  // no press required. The native fork gets the same trigger through
  // MightsPage's onNearBottom; there is no `window` there.
  useEffect(() => {
    if (typeof window === 'undefined' || !hasNextPage) return;
    const nearBottom = () => {
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 700) loadMoreAutomatically();
    };
    window.addEventListener('scroll', nearBottom, { passive: true });
    return () => window.removeEventListener('scroll', nearBottom);
  }, [hasNextPage, loadMoreAutomatically]);

  return (
    <MightsPage
      title="Harlem Music"
      mediaLayout="leading"
      lead="The artists who made Harlem a stage and a sound. Every profile names its sources and rights."
      onNearBottom={loadMoreAutomatically}
    >
      <MusicIndexBody query={query} onMore={loadMore} />
    </MightsPage>
  );
}
