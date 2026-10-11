'use client';

import type { MusicArtistRecord } from '@acme/app/content';
import { Image } from '@acme/ui';
import { Article, Section } from '@acme/ui/html';
import {
  MightsHeading,
  MightsNotchCard,
  MightsText,
  routes,
} from '@acme/ui/mights';
import { Text, View } from '@acme/ui/tw';
import { useQuery } from '@tanstack/react-query';
import {
  isArtistPhotoResult,
  type ArtistPhotoResult,
} from './artist-photo.ts';
import { musicConnectionLabel } from './music-format.ts';

const endpointFor = (names: readonly string[]): string => {
  const path = `/api/music/artist-photo?names=${encodeURIComponent(names.join('|'))}`;
  const base =
    process.env.EXPO_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL;
  if (!base) return path;
  try {
    return new URL(path, base).href;
  } catch {
    return path;
  }
};

async function fetchPhotos(names: readonly string[]): Promise<Record<string, ArtistPhotoResult | null>> {
  const response = await fetch(endpointFor(names), {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Artist photo service answered ${response.status}`);
  const body = (await response.json()) as { photos?: Record<string, unknown> };
  const photos: Record<string, ArtistPhotoResult | null> = {};
  for (const name of names) {
    const value = body.photos?.[name];
    photos[name] = isArtistPhotoResult(value) ? value : null;
  }
  return photos;
}

function ArtistPortrait({
  artist,
  photo,
  loading,
}: {
  artist: MusicArtistRecord;
  photo: ArtistPhotoResult | null | undefined;
  loading: boolean;
}) {
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

  if (photo) {
    const aspect = photo.width && photo.height ? photo.width / photo.height : 4 / 5;
    return (
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
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
          className="h-full w-full"
        />
        <Text
          numberOfLines={1}
          className="absolute bottom-0 right-0 max-w-full bg-mights-night/80 px-2 py-0.5 font-sans text-caption text-text-muted"
        >
          Artist photo · {photo.provider === 'wikimedia_commons' ? 'Wikimedia Commons' : 'Deezer'}
        </Text>
      </View>
    );
  }

  return (
    <View
      className="flex w-full shrink-0 items-center justify-center border-b border-rule-hairline bg-surface-sunken px-6"
      style={{ aspectRatio: 4 / 5 }}
    >
      <MightsText size="small" className="text-center text-text-muted">
        {loading ? `Loading ${artist.name} photo…` : `${artist.name} photo unavailable`}
      </MightsText>
    </View>
  );
}

function ArtistCard({
  artist,
  photo,
  loading,
}: {
  artist: MusicArtistRecord;
  photo: ArtistPhotoResult | null | undefined;
  loading: boolean;
}) {
  return (
    <Article className="flex flex-col">
      <MightsNotchCard href={routes.musician(artist.slug)} tone="raised">
        <ArtistPortrait artist={artist} photo={photo} loading={loading} />
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

export function MusicArtistGrid({ artists }: { artists: readonly MusicArtistRecord[] }) {
  const unresolvedNames = artists.filter((artist) => !artist.headshot).map((artist) => artist.name);
  const query = useQuery({
    queryKey: ['music-artist-photos', unresolvedNames],
    queryFn: () => fetchPhotos(unresolvedNames),
    enabled: unresolvedNames.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
  });

  return (
    <Section aria-label="Published artists">
      <View className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {artists.map((artist) => (
          <ArtistCard
            key={artist.id}
            artist={artist}
            photo={artist.headshot ? undefined : query.data?.[artist.name]}
            loading={!artist.headshot && query.isPending}
          />
        ))}
      </View>
    </Section>
  );
}
