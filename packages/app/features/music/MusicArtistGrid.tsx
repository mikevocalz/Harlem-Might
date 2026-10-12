'use client';

import type { MusicArtistRecord } from '@acme/app/content';
import { FadeIn, Image, useReducedMotion } from '@acme/ui';
import { Article, Section } from '@acme/ui/html';
import {
  MightsHeading,
  MightsNotchCard,
  MightsText,
  routes,
} from '@acme/ui/mights';
import { Text, View } from '@acme/ui/tw';
import { useQueries } from '@tanstack/react-query';
import { artistPhotoProviderLabel, type ArtistPhotoResult } from './artist-photo.ts';
import { fetchArtistPhotos } from './artist-photo-client.ts';
import { musicConnectionLabel } from './music-format.ts';
import { musicKeys } from './music.keys.ts';

function ArtistPortrait({
  artist,
  photo,
  loading,
  priority = false,
  photoDelay = 0,
}: {
  artist: MusicArtistRecord;
  photo: ArtistPhotoResult | null | undefined;
  loading: boolean;
  priority?: boolean;
  photoDelay?: number;
}) {
  const reduceMotion = useReducedMotion();
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
          loading={priority ? 'eager' : 'lazy'}
          priority={priority}
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

  if (photo) {
    const aspect = photo.width && photo.height ? photo.width / photo.height : 4 / 5;
    const portrait = (
      <View
        className="relative w-full shrink-0 overflow-hidden border-b border-rule-hairline bg-mights-night"
        style={{ aspectRatio: Math.max(0.72, Math.min(aspect, 1.25)) }}
      >
        <Image
          src={photo.url}
          alt={`${artist.name} artist photo`}
          fill
          contentFit="cover"
          contentPosition={{ top: '30%', left: '50%' }}
          loading={priority ? 'eager' : 'lazy'}
          priority={priority}
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
          className="h-full w-full"
        />
        <Text
          numberOfLines={2}
          className="absolute bottom-0 right-0 max-w-full bg-mights-night/85 px-2 py-1 font-sans text-caption text-text-muted"
        >
          {photo.credit} · {artistPhotoProviderLabel(photo.provider)}
          {photo.license ? ` · ${photo.license}` : ' · external reference'}
        </Text>
      </View>
    );
    // Fetched photos trickle in with the kit's entrance motion; CMS headshots
    // render statically because they arrive with the page data.
    return reduceMotion ? portrait : <FadeIn delay={photoDelay}>{portrait}</FadeIn>;
  }

  return (
    <View
      className="flex w-full shrink-0 items-center justify-center border-b border-rule-hairline bg-surface-sunken px-6"
      style={{ aspectRatio: 4 / 5 }}
    >
      <MightsText size="small" className="text-center text-text-muted">
        {loading ? `Loading ${artist.name} photo…` : `${artist.name} photo is awaiting a verified source.`}
      </MightsText>
    </View>
  );
}

function ArtistCard({
  artist,
  photo,
  loading,
  priority,
  photoDelay,
}: {
  artist: MusicArtistRecord;
  photo: ArtistPhotoResult | null | undefined;
  loading: boolean;
  priority: boolean;
  photoDelay: number;
}) {
  return (
    <Article className="flex flex-col">
      <MightsNotchCard href={routes.musician(artist.slug)} tone="raised">
        <ArtistPortrait artist={artist} photo={photo} loading={loading} priority={priority} photoDelay={photoDelay} />
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

/**
 * Names resolved per photo query. One page's lookup used to gate every card on
 * the slowest provider fetch; chunks let the first resolved batch paint while
 * the rest are still in flight, which is the trickle-in the grid wants.
 */
const ARTIST_PHOTO_CHUNK = 8;

export function MusicArtistGrid({ artists }: { artists: readonly MusicArtistRecord[] }) {
  const unresolvedNames = artists.filter((artist) => !artist.headshot).map((artist) => artist.name);
  const chunks: string[][] = [];
  for (let i = 0; i < unresolvedNames.length; i += ARTIST_PHOTO_CHUNK) {
    chunks.push(unresolvedNames.slice(i, i + ARTIST_PHOTO_CHUNK));
  }
  const queries = useQueries({
    queries: chunks.map((chunk) => ({
      queryKey: musicKeys.artistPhotos(chunk),
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchArtistPhotos(chunk, { signal }),
      staleTime: 24 * 60 * 60 * 1000,
    })),
  });
  // Merge chunk results back into the per-name lookup the cards render from.
  const photos: Record<string, ArtistPhotoResult | null | undefined> = {};
  const pending: Record<string, boolean> = {};
  queries.forEach((query, index) => {
    for (const name of chunks[index] ?? []) {
      photos[name] = query.data?.[name];
      pending[name] = query.isPending;
    }
  });

  return (
    <Section aria-label="Published artists">
      <View className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {artists.map((artist, index) => (
          <ArtistCard
            key={artist.id}
            artist={artist}
            photo={artist.headshot ? undefined : photos[artist.name]}
            loading={!artist.headshot && pending[artist.name] === true}
            priority={index < 3}
            photoDelay={Math.min(index * 45, 315)}
          />
        ))}
      </View>
    </Section>
  );
}
