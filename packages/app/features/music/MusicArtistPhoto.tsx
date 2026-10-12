'use client';

import type { MusicArtistRecord } from '@acme/app/content';
import { FadeIn, Image, useReducedMotion } from '@acme/ui';
import { Figure, Figcaption, Link } from '@acme/ui/html';
import { MightsEditorialImage, MightsText } from '@acme/ui/mights';
import { Text, View } from '@acme/ui/tw';
import { useQuery } from '@tanstack/react-query';
import { fetchArtistPhotos } from './artist-photo-client.ts';
import { artistPhotoProviderLabel } from './artist-photo.ts';
import { musicKeys } from './music.keys.ts';

export function MusicArtistPhoto({ artist }: { artist: MusicArtistRecord }) {
  const reduceMotion = useReducedMotion();
  const query = useQuery({
    queryKey: musicKeys.artistPhoto(artist.name),
    queryFn: async ({ signal }) => (await fetchArtistPhotos([artist.name], { signal }))[artist.name] ?? null,
    enabled: !artist.headshot,
    staleTime: 24 * 60 * 60 * 1000,
  });

  if (artist.headshot) {
    return (
      <MightsEditorialImage
        image={artist.headshot}
        screenId={`music-${artist.slug}`}
        ratio="standard"
        priority
        sizes="(min-width: 768px) 60vw, 100vw"
      />
    );
  }

  const photo = query.data;
  if (photo) {
    const aspect = photo.width && photo.height ? photo.width / photo.height : 4 / 5;
    const figure = (
      <Figure aria-label={`${artist.name} artist photo`} className="flex flex-col gap-2">
        <View
          className="relative overflow-hidden bg-surface-sunken"
          style={{ aspectRatio: Math.max(0.72, Math.min(aspect, 1.25)) }}
        >
          <Image
            src={photo.url}
            alt={`${artist.name} artist photo`}
            fill
            priority
            contentFit="cover"
            contentPosition={{ top: '30%', left: '50%' }}
            sizes="(min-width: 768px) 60vw, 100vw"
            className="absolute inset-0 h-full w-full"
          />
        </View>
        <Figcaption className="flex flex-col gap-1 text-label text-text-muted">
          <Text className="font-sans text-text-muted">
            {photo.credit}.{' '}
            {photo.rightsStatus === 'provider-reference'
              ? 'External reference image; no local licence claim. '
              : ''}

            <Link
              href={photo.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              {`${artistPhotoProviderLabel(photo.provider)} source`}
            </Link>
            {photo.license && photo.licenseUrl ? (
              <>
                {' · '}
                <Link
                  href={photo.licenseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  {photo.license}
                </Link>
              </>
            ) : null}
          </Text>
        </Figcaption>
      </Figure>
    );
    // Fetched photos get the kit's entrance motion; CMS headshots stay static.
    return reduceMotion ? figure : <FadeIn>{figure}</FadeIn>;
  }

  return (
    <View
      className="flex w-full items-center justify-center bg-surface-sunken px-6"
      style={{ aspectRatio: 4 / 5 }}
    >
      <MightsText size="small" className="text-center text-text-muted">
        {query.isPending
          ? `Loading ${artist.name} photo…`
          : `${artist.name} photo is awaiting a verified source.`}
      </MightsText>
    </View>
  );
}
