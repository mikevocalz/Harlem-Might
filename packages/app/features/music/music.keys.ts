export const musicKeys = {
  all: ['music'] as const,
  artists: ['music-artists'] as const,
  artist: (slug: string) => ['music-artist', slug] as const,
  artistPhotos: (names: readonly string[]) =>
    [...musicKeys.all, 'artist-photos', ...names] as const,
  artistPhoto: (name: string) =>
    [...musicKeys.all, 'artist-photo', name] as const,
} as const;
