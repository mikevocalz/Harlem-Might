export const musicKeys = {
  all: ['music'] as const,
  artistPhotos: (names: readonly string[]) =>
    [...musicKeys.all, 'artist-photos', ...names] as const,
  artistPhoto: (name: string) =>
    [...musicKeys.all, 'artist-photo', name] as const,
} as const;
