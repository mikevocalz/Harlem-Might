import { PHOTO_RESOLVER_VERSION } from './artist-photo-client.ts';

export const musicKeys = {
  all: ['music'] as const,
  artists: ['music-artists'] as const,
  artist: (slug: string) => ['music-artist', slug] as const,
  artistPhotos: (names: readonly string[]) =>
    [...musicKeys.all, 'artist-photos', PHOTO_RESOLVER_VERSION, ...names] as const,
  artistPhoto: (name: string) =>
    [...musicKeys.all, 'artist-photo', PHOTO_RESOLVER_VERSION, name] as const,
} as const;
