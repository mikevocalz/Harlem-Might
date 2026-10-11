'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { ExploreLoader } from '@acme/spatial/explore-loader';
import {
  getHarlemArchivalImage,
  type ContentResult,
  type MusicArtistPage,
  type MusicArtistRecord,
  type UnavailableReason,
} from '@acme/app/content';
import { Article, Section } from '@acme/ui/html';
import { Image, useReducedMotion } from '@acme/ui';
import {
  MightsButton,
  MightsEditorialImage,
  MightsHeading,
  MightsNotchCard,
  MightsPage,
  MightsText,
  routes,
} from '@acme/ui/mights';
import { Text, View } from '@acme/ui/tw';
import { ContentLoader } from '../site/content/ContentLoader.tsx';
import { ContentNotice } from '../site/content/ContentNotice.tsx';
import { musicKeys } from './music.keys.ts';
import { artistArchiveFallback, musicConnectionLabel } from './music-format.ts';

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

const heroImage = getHarlemArchivalImage('nypl-seventh-avenue-west-125th-1934');
const archiveImage = getHarlemArchivalImage('nypl-harlem-storefronts-1939');

const hero = heroImage ? (
  <MightsEditorialImage
    image={heroImage}
    screenId="music-hero"
    ratio="wide"
    priority
    sizes="(min-width: 768px) 60vw, 100vw"
  />
) : undefined;

/** The card's portrait well: the rights-cleared headshot with its credit, or an archival frame. */
function ArtistPortrait({ artist }: { artist: MusicArtistRecord }) {
  const image = artist.headshot;
  if (image) {
    return (
      <View
        className="relative w-full shrink-0 overflow-hidden border-b border-rule-hairline bg-mights-night"
        style={{ aspectRatio: image.aspect ?? 1 }}
      >
        <Image
          src={image.url}
          alt={image.altText}
          fill
          contentFit={image.aspect ? 'cover' : 'contain'}
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
          className="h-full w-full"
        />
        <Text
          numberOfLines={1}
          className="absolute bottom-0 right-0 max-w-full bg-mights-night/80 px-2 py-0.5 font-sans text-caption text-text-muted"
        >
          {image.credit} · {image.license}
        </Text>
      </View>
    );
  }
  const archive = artistArchiveFallback(artist.slug);
  return archive ? (
    <View className="w-full shrink-0 border-b border-rule-hairline">
      <MightsEditorialImage
        image={archive}
        screenId={`music-card-${artist.slug}`}
        ratio="standard"
        interactiveCredit={false}
        sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
      />
    </View>
  ) : null;
}

function ArtistCard({ artist }: { artist: MusicArtistRecord }) {
  return (
    <Article className="flex flex-col">
      <MightsNotchCard href={routes.musician(artist.slug)} tone="raised">
        <ArtistPortrait artist={artist} />
        <View className="flex flex-1 flex-col gap-3 p-5">
          <View>
            <MightsHeading level={2} size="card">
              {artist.name}
            </MightsHeading>
            <MightsText size="small" className="mt-1 font-semibold uppercase tracking-[0.12em] text-primary">
              {artist.genre}
              {artist.era ? ` · ${artist.era}` : ''}
            </MightsText>
          </View>
          <MightsText size="small" className="line-clamp-3">
            {artist.shortBio}
          </MightsText>
          <MightsText size="small" className="mt-auto text-text-muted">
            {musicConnectionLabel(artist.connection)}
          </MightsText>
        </View>
      </MightsNotchCard>
    </Article>
  );
}

function ArtistGrid({ artists }: { artists: readonly MusicArtistRecord[] }) {
  return (
    <Section aria-label="Published artists">
      <View className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {artists.map((artist) => (
          <ArtistCard key={artist.id} artist={artist} />
        ))}
      </View>
    </Section>
  );
}

/** The tail of the directory: the small ExploreLoader while a page is in flight. */
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
  return (
    <View className="mt-10 flex flex-col items-center gap-4">
      {isFetching ? (
        <View role="status" className="items-center justify-center py-2">
          <Text className="sr-only">Loading more artists</Text>
          <ExploreLoader size={56} phase={reducedMotion ? 'reduced' : 'loading'} label="Loading more artists" />
        </View>
      ) : failed ? (
        <MightsButton variant="secondary" onPress={onMore}>
          Try again
        </MightsButton>
      ) : hasNextPage ? (
        <MightsButton variant="secondary" onPress={onMore}>
          More artists
        </MightsButton>
      ) : null}
      {total > shown ? (
        <MightsText size="small" className="text-text-muted">
          {shown} of {total} artists
        </MightsText>
      ) : null}
    </View>
  );
}

function MusicIndexBody({
  query,
}: {
  query: ReturnType<typeof useMusicArtists>;
}) {
  const pages = query.data?.pages;
  const artists = pages?.flatMap((page) => page.artists) ?? [];
  const total = pages?.at(-1)?.totalDocs ?? artists.length;

  if (query.isPending) return <ContentLoader label="Checking for published artists" />;
  if (artists.length === 0 && query.isError) {
    return (
      <ContentNotice
        title="We couldn’t check the music directory right now"
        image={archiveImage}
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
        image={archiveImage}
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
      <ArtistGrid artists={artists} />
      <LoadMore
        shown={artists.length}
        total={total}
        hasNextPage={query.hasNextPage}
        isFetching={query.isFetchingNextPage}
        failed={query.isFetchNextPageError}
        onMore={() => void query.fetchNextPage()}
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
  return (
    <MightsPage
      title="Harlem Music"
      mediaLayout="leading"
      lead="The artists who made Harlem a stage and a sound. Every profile names its sources and rights."
      media={hero}
    >
      <MusicIndexBody query={query} />
    </MightsPage>
  );
}
