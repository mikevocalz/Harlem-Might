'use client';

import type { MusicArtistRecord } from '@acme/app/content';
import { Image } from '@acme/ui';
import { Figure, Figcaption, Link } from '@acme/ui/html';
import { MightsEditorialImage, MightsText } from '@acme/ui/mights';
import { Text, View } from '@acme/ui/tw';
import { useQuery } from '@tanstack/react-query';
import { fetchArtistPhotos } from './artist-photo-client.ts';
import { artistPhotoImageProps, artistPhotoProviderLabel } from './artist-photo.ts';
import { artistPhotoFraming, shouldUseStoredArtistPhoto } from './artist-photo-policy.ts';
import { musicKeys } from './music.keys.ts';

export function MusicArtistPhoto({ artist }: { artist: MusicArtistRecord }) {
  const useStored = shouldUseStoredArtistPhoto(artist);
  const query = useQuery({
    queryKey: musicKeys.artistPhoto(artist.name),
    queryFn: async () => (await fetchArtistPhotos([artist.name]))[artist.name] ?? null,
    enabled: !useStored,
    staleTime: 24 * 60 * 60 * 1000,
  });

  if (useStored && artist.headshot) {
    return (
      <MightsEditorialImage
        image={artist.headshot}
        screenId={`music-${artist.slug}`}
        ratio="standard"
        preserveFraming
        priority
        sizes="(min-width: 768px) 60vw, 100vw"
      />
    );
  }

  const photo = query.data;
  if (photo) {
    const framing = artistPhotoFraming(photo);
    return (
      <Figure aria-label={`${artist.name} artist photo`} className="flex flex-col gap-2">
        <View
          className="relative overflow-hidden bg-surface-sunken"
          style={{ aspectRatio: framing.aspectRatio }}
        >
          <Image
            {...artistPhotoImageProps(photo)}
            alt={`${artist.name} artist photo`}
            fill
            priority
            contentFit={framing.contentFit}
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
